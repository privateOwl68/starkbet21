use shoe::interfaces::{
    IWagerWarDispatcher, IWagerWarDispatcherTrait, IBlackjackGameDispatcher,
    IBlackjackGameDispatcherTrait,
};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;

fn owner() -> ContractAddress {
    0x111.try_into().unwrap()
}

fn game_addr() -> ContractAddress {
    0x222.try_into().unwrap()
}

fn player_a() -> ContractAddress {
    0xaaa.try_into().unwrap()
}

fn player_b() -> ContractAddress {
    0xbbb.try_into().unwrap()
}

fn deploy_war() -> IWagerWarDispatcher {
    let class = declare("wager_war").unwrap().contract_class();
    let mut calldata = array![];
    Serde::serialize(@owner(), ref calldata);
    let (address, _) = class.deploy(@calldata).unwrap();
    IWagerWarDispatcher { contract_address: address }
}

#[test]
fn open_season_and_record_from_game() {
    let war = deploy_war();
    let war_addr = war.contract_address;

    start_cheat_caller_address(war_addr, owner());
    war.set_game(game_addr());
    start_cheat_block_timestamp(war_addr, 1_000);
    war.open_season(1_000, 2_000);
    stop_cheat_caller_address(war_addr);

    let season = war.get_season();
    assert(season.season_id == 1, 'sid');
    assert(season.live, 'live');

    start_cheat_caller_address(war_addr, game_addr());
    war.record_wager(player_a(), 100_u256, true);
    war.record_wager(player_a(), 50_u256, false);
    war.record_wager(player_b(), 200_u256, true);
    stop_cheat_caller_address(war_addr);

    assert(war.get_volume(1, player_a()) == 150_u256, 'vol a');
    assert(war.get_hands(1, player_a()) == 1, 'hands a');
    assert(war.get_volume(1, player_b()) == 200_u256, 'vol b');
    assert(war.get_hands(1, player_b()) == 1, 'hands b');

    let top = war.get_top(1, 10);
    assert(top.len() == 2, 'top len');
    assert(*top.at(0).player == player_b(), 'first b');
    assert(*top.at(0).volume == 200_u256, 'first vol');
    assert(*top.at(1).player == player_a(), 'second a');
}

#[test]
#[should_panic(expected: 'only game')]
fn record_rejects_non_game() {
    let war = deploy_war();
    let war_addr = war.contract_address;
    start_cheat_caller_address(war_addr, owner());
    war.set_game(game_addr());
    start_cheat_block_timestamp(war_addr, 1_000);
    war.open_season(1_000, 2_000);
    stop_cheat_caller_address(war_addr);
    war.record_wager(player_a(), 10_u256, true);
}

#[test]
#[should_panic(expected: 'season not live')]
fn record_rejects_outside_window() {
    let war = deploy_war();
    let war_addr = war.contract_address;
    start_cheat_caller_address(war_addr, owner());
    war.set_game(game_addr());
    start_cheat_block_timestamp(war_addr, 500);
    war.open_season(1_000, 2_000);
    stop_cheat_caller_address(war_addr);

    start_cheat_caller_address(war_addr, game_addr());
    war.record_wager(player_a(), 10_u256, true);
}

#[test]
fn close_season_stops_recording() {
    let war = deploy_war();
    let war_addr = war.contract_address;
    start_cheat_caller_address(war_addr, owner());
    war.set_game(game_addr());
    start_cheat_block_timestamp(war_addr, 1_000);
    war.open_season(1_000, 2_000);
    war.close_season();
    stop_cheat_caller_address(war_addr);
    assert(!war.get_season().live, 'not live');
}

#[test]
fn blackjack_deal_reports_volume() {
    let war_class = declare("wager_war").unwrap().contract_class();
    let mut war_cd = array![];
    Serde::serialize(@owner(), ref war_cd);
    let (war_addr, _) = war_class.deploy(@war_cd).unwrap();
    let war = IWagerWarDispatcher { contract_address: war_addr };

    let game_class = declare("blackjack_game").unwrap().contract_class();
    let mut game_cd = array![];
    Serde::serialize(@42_felt252, ref game_cd);
    Serde::serialize(@owner(), ref game_cd);
    let (gaddr, _) = game_class.deploy(@game_cd).unwrap();
    let game = IBlackjackGameDispatcher { contract_address: gaddr };

    start_cheat_caller_address(war_addr, owner());
    war.set_game(gaddr);
    stop_cheat_caller_address(war_addr);

    start_cheat_caller_address(gaddr, owner());
    game.set_wager_war(war_addr);
    stop_cheat_caller_address(gaddr);

    start_cheat_block_timestamp(war_addr, 10_000);
    start_cheat_caller_address(war_addr, owner());
    war.open_season(10_000, 20_000);
    stop_cheat_caller_address(war_addr);

    start_cheat_caller_address(gaddr, player_a());
    game.buy_in(1_000_u256);
    game.deal(25_u256);
    stop_cheat_caller_address(gaddr);

    assert(war.get_volume(1, player_a()) == 25_u256, 'deal vol');
    assert(war.get_hands(1, player_a()) == 1, 'deal hands');
}
