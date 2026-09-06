//! BlackjackGame — public localnet V0 (no notes yet).
//! Deterministic shoe from constructor seed; chips are contract-minted stacks.
//! Optional WagerWar hook records deal/double volume for leaderboard seasons.

#[starknet::contract]
mod blackjack_game {
    use crate::hand::{Card, dealer_should_hit, is_blackjack, is_bust};
    use crate::interfaces::{IBlackjackGame, IWagerWarDispatcher, IWagerWarDispatcherTrait, RoundView};
    use crate::settlement::{blackjack_payout, even_money_win, lose, push_return};
    use crate::shoe::{commit_shoe, draw_card, unpack_card};
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};

    const PHASE_IDLE: u8 = 0;
    const PHASE_PLAYER: u8 = 1;
    const PHASE_DONE: u8 = 2;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        wager_war: ContractAddress,
        shoe_commitment: felt252,
        seed: felt252,
        global_draw_index: u32,
        stacks: Map<ContractAddress, u256>,
        bets: Map<ContractAddress, u256>,
        phases: Map<ContractAddress, u8>,
        player_len: Map<ContractAddress, u8>,
        dealer_len: Map<ContractAddress, u8>,
        player_cards: Map<(ContractAddress, u8), u8>,
        dealer_cards: Map<(ContractAddress, u8), u8>,
        hole_hidden: Map<ContractAddress, bool>,
        doubled: Map<ContractAddress, bool>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, shoe_seed: felt252, owner: ContractAddress) {
        self.owner.write(owner);
        self.seed.write(shoe_seed);
        self.shoe_commitment.write(commit_shoe(shoe_seed, 1));
        self.global_draw_index.write(0);
    }

    #[abi(embed_v0)]
    impl BlackjackGameImpl of IBlackjackGame<ContractState> {
        fn buy_in(ref self: ContractState, amount: u256) {
            assert(amount > 0, 'amount=0');
            let player = get_caller_address();
            let bal = self.stacks.read(player);
            self.stacks.write(player, bal + amount);
        }

        fn deal(ref self: ContractState, bet: u256) {
            let player = get_caller_address();
            assert(self.phases.read(player) != PHASE_PLAYER, 'round active');
            assert(bet > 0, 'bet=0');
            let stack = self.stacks.read(player);
            assert(stack >= bet, 'insufficient stack');

            self.stacks.write(player, stack - bet);
            self.bets.write(player, bet);
            self.doubled.write(player, false);
            self.clear_hands(player);
            self.report_wager(player, bet, true);

            let c0 = self.draw_next();
            let c1 = self.draw_next();
            let c2 = self.draw_next();
            let c3 = self.draw_next();

            self.push_player(player, c0);
            self.push_dealer(player, c1);
            self.push_player(player, c2);
            self.push_dealer(player, c3);
            self.hole_hidden.write(player, true);

            let player_cards = self.load_player(player);
            let dealer_cards = self.load_dealer(player);

            if is_blackjack(player_cards.span()) || is_blackjack(dealer_cards.span()) {
                self.hole_hidden.write(player, false);
                self.finish_round(player);
                return;
            }

            self.phases.write(player, PHASE_PLAYER);
        }

        fn hit(ref self: ContractState, hand_index: u8) {
            assert(hand_index == 0, 'no split v0');
            let player = get_caller_address();
            assert(self.phases.read(player) == PHASE_PLAYER, 'not your turn');
            assert(!self.doubled.read(player), 'already doubled');

            let card = self.draw_next();
            self.push_player(player, card);
            let cards = self.load_player(player);
            if is_bust(cards.span()) {
                self.hole_hidden.write(player, false);
                self.finish_round(player);
            }
        }

        fn stand(ref self: ContractState, hand_index: u8) {
            assert(hand_index == 0, 'no split v0');
            let player = get_caller_address();
            assert(self.phases.read(player) == PHASE_PLAYER, 'not your turn');
            self.play_dealer_and_finish(player);
        }

        fn double(ref self: ContractState, hand_index: u8) {
            assert(hand_index == 0, 'no split v0');
            let player = get_caller_address();
            assert(self.phases.read(player) == PHASE_PLAYER, 'not your turn');
            assert(self.player_len.read(player) == 2, 'need 2 cards');
            assert(!self.doubled.read(player), 'already doubled');

            let bet = self.bets.read(player);
            let stack = self.stacks.read(player);
            assert(stack >= bet, 'insufficient stack');
            self.stacks.write(player, stack - bet);
            self.bets.write(player, bet * 2);
            self.doubled.write(player, true);
            self.report_wager(player, bet, false);

            let card = self.draw_next();
            self.push_player(player, card);
            let cards = self.load_player(player);
            if is_bust(cards.span()) {
                self.hole_hidden.write(player, false);
                self.finish_round(player);
            } else {
                self.play_dealer_and_finish(player);
            }
        }

        fn split(ref self: ContractState, hand_index: u8) {
            let _ = hand_index;
            assert(false, 'split later');
        }

        fn insurance(ref self: ContractState) {
            assert(false, 'insurance later');
        }

        fn settle(ref self: ContractState) {
            let player = get_caller_address();
            assert(self.phases.read(player) == PHASE_DONE, 'not settled');
            self.phases.write(player, PHASE_IDLE);
            self.clear_hands(player);
            self.bets.write(player, 0);
            self.doubled.write(player, false);
            self.hole_hidden.write(player, true);
        }

        fn set_wager_war(ref self: ContractState, war: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'only owner');
            self.wager_war.write(war);
        }

        fn shoe_commitment(self: @ContractState) -> felt252 {
            self.shoe_commitment.read()
        }

        fn get_stack(self: @ContractState, player: ContractAddress) -> u256 {
            self.stacks.read(player)
        }

        fn get_round(self: @ContractState, player: ContractAddress) -> RoundView {
            RoundView {
                phase: self.phases.read(player),
                bet: self.bets.read(player),
                stack: self.stacks.read(player),
                draw_index: self.global_draw_index.read(),
                shoe_commitment: self.shoe_commitment.read(),
                hole_hidden: self.hole_hidden.read(player),
                player_len: self.player_len.read(player),
                dealer_len: self.dealer_len.read(player),
            }
        }

        fn get_player_card(self: @ContractState, player: ContractAddress, index: u8) -> u8 {
            self.player_cards.read((player, index))
        }

        fn get_dealer_card(self: @ContractState, player: ContractAddress, index: u8) -> u8 {
            self.dealer_cards.read((player, index))
        }

        fn seed(self: @ContractState) -> felt252 {
            self.seed.read()
        }

        fn wager_war(self: @ContractState) -> ContractAddress {
            self.wager_war.read()
        }

        fn owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn report_wager(
            ref self: ContractState, player: ContractAddress, amount: u256, new_hand: bool,
        ) {
            let war = self.wager_war.read();
            if war.is_zero() {
                return;
            }
            IWagerWarDispatcher { contract_address: war }.record_wager(player, amount, new_hand);
        }

        fn draw_next(ref self: ContractState) -> u8 {
            let idx = self.global_draw_index.read();
            assert(idx < 52, 'shoe empty');
            let card = draw_card(self.seed.read(), 1, idx);
            self.global_draw_index.write(idx + 1);
            card
        }

        fn clear_hands(ref self: ContractState, player: ContractAddress) {
            let mut i: u8 = 0;
            let plen = self.player_len.read(player);
            while i < plen {
                self.player_cards.write((player, i), 0);
                i += 1;
            }
            let mut j: u8 = 0;
            let dlen = self.dealer_len.read(player);
            while j < dlen {
                self.dealer_cards.write((player, j), 0);
                j += 1;
            }
            self.player_len.write(player, 0);
            self.dealer_len.write(player, 0);
        }

        fn push_player(ref self: ContractState, player: ContractAddress, card: u8) {
            let i = self.player_len.read(player);
            self.player_cards.write((player, i), card);
            self.player_len.write(player, i + 1);
        }

        fn push_dealer(ref self: ContractState, player: ContractAddress, card: u8) {
            let i = self.dealer_len.read(player);
            self.dealer_cards.write((player, i), card);
            self.dealer_len.write(player, i + 1);
        }

        fn load_player(self: @ContractState, player: ContractAddress) -> Array<Card> {
            let mut out: Array<Card> = array![];
            let len = self.player_len.read(player);
            let mut i: u8 = 0;
            while i < len {
                out.append(self.to_card(self.player_cards.read((player, i))));
                i += 1;
            }
            out
        }

        fn load_dealer(self: @ContractState, player: ContractAddress) -> Array<Card> {
            let mut out: Array<Card> = array![];
            let len = self.dealer_len.read(player);
            let mut i: u8 = 0;
            while i < len {
                out.append(self.to_card(self.dealer_cards.read((player, i))));
                i += 1;
            }
            out
        }

        fn to_card(self: @ContractState, id: u8) -> Card {
            let (rank, suit) = unpack_card(id);
            Card { rank, suit }
        }

        fn play_dealer_and_finish(ref self: ContractState, player: ContractAddress) {
            self.hole_hidden.write(player, false);
            let mut dealer = self.load_dealer(player);
            while dealer_should_hit(dealer.span(), true) {
                let card = self.draw_next();
                self.push_dealer(player, card);
                dealer = self.load_dealer(player);
            }
            self.finish_round(player);
        }

        fn finish_round(ref self: ContractState, player: ContractAddress) {
            let bet = self.bets.read(player);
            let player_cards = self.load_player(player);
            let dealer_cards = self.load_dealer(player);
            let payout = Self::payout(player_cards.span(), dealer_cards.span(), bet);
            if payout > 0 {
                let stack = self.stacks.read(player);
                self.stacks.write(player, stack + payout);
            }
            self.phases.write(player, PHASE_DONE);
        }

        fn payout(player: Span<Card>, dealer: Span<Card>, bet: u256) -> u256 {
            if is_bust(player) {
                return lose(bet);
            }
            let player_bj = is_blackjack(player);
            let dealer_bj = is_blackjack(dealer);
            if player_bj && !dealer_bj {
                return blackjack_payout(bet);
            }
            if dealer_bj && !player_bj {
                return lose(bet);
            }
            if player_bj && dealer_bj {
                return push_return(bet);
            }
            if is_bust(dealer) {
                return even_money_win(bet);
            }
            let pt = crate::hand::hand_value(player).total;
            let dt = crate::hand::hand_value(dealer).total;
            if pt > dt {
                return even_money_win(bet);
            }
            if pt < dt {
                return lose(bet);
            }
            push_return(bet)
        }
    }
}
