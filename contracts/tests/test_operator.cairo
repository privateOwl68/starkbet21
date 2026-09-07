use shoe::interfaces::{IBlackjackGameDispatcher, IBlackjackGameDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;

fn deploy_game(owner: ContractAddress) -> ContractAddress {
    let class = declare("blackjack_game").unwrap().contract_class();
    let (addr, _) = class.deploy(@array![42, owner.into()]).unwrap();
    addr
}

fn addr(n: felt252) -> ContractAddress {
    n.try_into().unwrap()
}

#[test]
fn operator_can_deal_for_player() {
    let owner = addr(1);
    let player = addr(2);
    let relayer = addr(3);
    let game = deploy_game(owner);
    let game_d = IBlackjackGameDispatcher { contract_address: game };

    start_cheat_caller_address(game, player);
    game_d.buy_in(1000);
    game_d.set_operator(relayer);
    stop_cheat_caller_address(game);

    assert(game_d.get_operator(player) == relayer, 'op set');

    start_cheat_caller_address(game, relayer);
    game_d.deal_for(player, 10);
    stop_cheat_caller_address(game);

    let round = game_d.get_round(player);
    assert(round.bet == 10, 'bet');
    assert(round.stack == 990, 'stack');
}

#[test]
#[should_panic(expected: 'not authorized')]
fn stranger_cannot_deal_for_player() {
    let owner = addr(1);
    let player = addr(2);
    let stranger = addr(9);
    let game = deploy_game(owner);
    let game_d = IBlackjackGameDispatcher { contract_address: game };

    start_cheat_caller_address(game, player);
    game_d.buy_in(1000);
    stop_cheat_caller_address(game);

    start_cheat_caller_address(game, stranger);
    game_d.deal_for(player, 10);
    stop_cheat_caller_address(game);
}

#[test]
#[should_panic(expected: 'free buy_in disabled')]
fn buy_in_disabled_when_vault_set() {
    let owner = addr(1);
    let player = addr(2);
    let game = deploy_game(owner);
    let game_d = IBlackjackGameDispatcher { contract_address: game };

    start_cheat_caller_address(game, owner);
    game_d.set_strk_vault(addr(100), addr(101));
    stop_cheat_caller_address(game);

    start_cheat_caller_address(game, player);
    game_d.buy_in(1000);
    stop_cheat_caller_address(game);
}
