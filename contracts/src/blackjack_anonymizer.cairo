//! Blackjack STRK20 anonymizer — private buy-in / cash-out via privacy pool.
//!
//! Atomic sandwich (pool-driven):
//!   withdraw STRK → privacy_invoke → (buy-in credits chips | cash-out → open note)
//!
//! DRAFT for team review / audit before mainnet. Labels: hackathon integration scaffold.

use starknet::ContractAddress;
use crate::open_note::OpenNoteDeposit;

/// op = 0 buy-in (park STRK in game vault, credit player chips)
/// op = 1 cash-out (burn chips, credit STRK to open note)
pub const OP_BUY_IN: u8 = 0;
pub const OP_CASH_OUT: u8 = 1;

#[starknet::interface]
pub trait IBlackjackAnonymizer<TContractState> {
    fn privacy_invoke(
        ref self: TContractState,
        op: u8,
        player: ContractAddress,
        amount: u128,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;
    fn game(self: @TContractState) -> ContractAddress;
    fn strk_token(self: @TContractState) -> ContractAddress;
    fn privacy_pool(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod blackjack_anonymizer {
    use core::num::traits::Zero;
    use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::interfaces::{IBlackjackGameDispatcher, IBlackjackGameDispatcherTrait};
    use crate::open_note::OpenNoteDeposit;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::{IBlackjackAnonymizer, OP_BUY_IN, OP_CASH_OUT};

    #[storage]
    struct Storage {
        game: ContractAddress,
        strk_token: ContractAddress,
        /// Pinned privacy pool — only it may call privacy_invoke.
        privacy_pool: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        game: ContractAddress,
        strk_token: ContractAddress,
        privacy_pool: ContractAddress,
    ) {
        assert(game.is_non_zero(), 'zero game');
        assert(strk_token.is_non_zero(), 'zero token');
        assert(privacy_pool.is_non_zero(), 'zero pool');
        self.game.write(game);
        self.strk_token.write(strk_token);
        self.privacy_pool.write(privacy_pool);
    }

    #[abi(embed_v0)]
    impl BlackjackAnonymizerImpl of IBlackjackAnonymizer<ContractState> {
        fn privacy_invoke(
            ref self: ContractState,
            op: u8,
            player: ContractAddress,
            amount: u128,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            let pool = get_caller_address();
            assert(pool == self.privacy_pool.read(), 'CALLER_NOT_PRIVACY');
            assert(player.is_non_zero(), 'zero player');
            assert(amount.is_non_zero(), 'zero amount');

            let token = self.strk_token.read();
            let game = self.game.read();
            let self_addr = get_contract_address();
            let erc20 = IERC20Dispatcher { contract_address: token };
            let game_disp = IBlackjackGameDispatcher { contract_address: game };
            let amt_u256: u256 = amount.into();

            if op == OP_BUY_IN {
                // Pool already withdrew `amount` STRK to this helper.
                let bal = erc20.balance_of(self_addr);
                assert(bal >= amt_u256, 'INSUFFICIENT_BALANCE');
                let ok = erc20.transfer(game, amt_u256);
                assert(ok, 'transfer failed');
                game_disp.credit_buy_in(player, amt_u256);
                // Funds stay in the game vault — no open-note credit.
                return array![].span();
            }

            if op == OP_CASH_OUT {
                assert(note_id.is_non_zero(), 'zero note');
                // Pull chips → STRK from game to this helper, then approve pool.
                game_disp.release_cash_out(player, amt_u256);
                let bal = erc20.balance_of(self_addr);
                assert(bal >= amt_u256, 'INSUFFICIENT_BALANCE');
                let ok = erc20.approve(pool, amt_u256);
                assert(ok, 'approve failed');
                let deposit = OpenNoteDeposit { note_id, token, amount };
                return array![deposit].span();
            }

            assert(false, 'bad op');
            array![].span()
        }

        fn game(self: @ContractState) -> ContractAddress {
            self.game.read()
        }

        fn strk_token(self: @ContractState) -> ContractAddress {
            self.strk_token.read()
        }

        fn privacy_pool(self: @ContractState) -> ContractAddress {
            self.privacy_pool.read()
        }
    }
}
