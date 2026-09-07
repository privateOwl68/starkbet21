use shoe::blackjack_anonymizer::{
    IBlackjackAnonymizerDispatcher, IBlackjackAnonymizerDispatcherTrait, OP_BUY_IN, OP_CASH_OUT,
};
use shoe::interfaces::{IBlackjackGameDispatcher, IBlackjackGameDispatcherTrait};
use shoe::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use shoe::mock_erc20::{IMockErc20Dispatcher, IMockErc20DispatcherTrait};
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

fn deploy_token() -> ContractAddress {
    let class = declare("mock_erc20").unwrap().contract_class();
    let (addr, _) = class.deploy(@array![]).unwrap();
    addr
}

fn deploy_anonymizer(
    game: ContractAddress, token: ContractAddress, pool: ContractAddress,
) -> ContractAddress {
    let class = declare("blackjack_anonymizer").unwrap().contract_class();
    let (addr, _) = class.deploy(@array![game.into(), token.into(), pool.into()]).unwrap();
    addr
}

fn addr(n: felt252) -> ContractAddress {
    n.try_into().unwrap()
}

#[test]
fn private_buy_in_credits_stack_and_parks_strk() {
    let owner = addr(1);
    let player = addr(2);
    let pool = addr(99);
    let game = deploy_game(owner);
    let token = deploy_token();
    let anon = deploy_anonymizer(game, token, pool);

    let game_d = IBlackjackGameDispatcher { contract_address: game };
    start_cheat_caller_address(game, owner);
    game_d.set_strk_vault(token, anon);
    stop_cheat_caller_address(game);

    let amount: u128 = 1_000;
    let token_mint = IMockErc20Dispatcher { contract_address: token };
    token_mint.mint(anon, amount.into());

    let anon_d = IBlackjackAnonymizerDispatcher { contract_address: anon };
    start_cheat_caller_address(anon, pool);
    let deposits = anon_d.privacy_invoke(OP_BUY_IN, player, amount, 0);
    stop_cheat_caller_address(anon);
    assert(deposits.len() == 0, 'buy-in returns empty span');

    assert(game_d.get_stack(player) == amount.into(), 'chips credited');
    let erc20 = IERC20Dispatcher { contract_address: token };
    assert(erc20.balance_of(game) == amount.into(), 'strk parked in game');
    assert(erc20.balance_of(anon) == 0, 'anon empty after buy-in');
}

#[test]
fn private_cash_out_returns_open_note_deposit() {
    let owner = addr(1);
    let player = addr(2);
    let pool = addr(99);
    let game = deploy_game(owner);
    let token = deploy_token();
    let anon = deploy_anonymizer(game, token, pool);

    let game_d = IBlackjackGameDispatcher { contract_address: game };
    start_cheat_caller_address(game, owner);
    game_d.set_strk_vault(token, anon);
    stop_cheat_caller_address(game);

    let amount: u128 = 500;
    let token_mint = IMockErc20Dispatcher { contract_address: token };
    token_mint.mint(anon, amount.into());

    let anon_d = IBlackjackAnonymizerDispatcher { contract_address: anon };
    start_cheat_caller_address(anon, pool);
    anon_d.privacy_invoke(OP_BUY_IN, player, amount, 0);

    let note_id: felt252 = 0xabc;
    let deposits = anon_d.privacy_invoke(OP_CASH_OUT, player, amount, note_id);
    stop_cheat_caller_address(anon);
    assert(deposits.len() == 1, 'one open note');
    let d = *deposits.at(0);
    assert(d.note_id == note_id, 'note id');
    assert(d.token == token, 'token');
    assert(d.amount == amount, 'amount');

    assert(game_d.get_stack(player) == 0, 'chips burned');
    let erc20 = IERC20Dispatcher { contract_address: token };
    assert(erc20.balance_of(anon) == amount.into(), 'strk on anon for pool pull');
}

#[test]
#[should_panic(expected: ('CALLER_NOT_PRIVACY',))]
fn reject_non_pool_caller() {
    let owner = addr(1);
    let player = addr(2);
    let pool = addr(99);
    let game = deploy_game(owner);
    let token = deploy_token();
    let anon = deploy_anonymizer(game, token, pool);

    let game_d = IBlackjackGameDispatcher { contract_address: game };
    start_cheat_caller_address(game, owner);
    game_d.set_strk_vault(token, anon);
    stop_cheat_caller_address(game);

    let anon_d = IBlackjackAnonymizerDispatcher { contract_address: anon };
    start_cheat_caller_address(anon, addr(7));
    anon_d.privacy_invoke(OP_BUY_IN, player, 1, 0);
}
