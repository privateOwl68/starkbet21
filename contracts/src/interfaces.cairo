//! Shared interfaces for BlackjackGame and external callers.

use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
pub struct RoundView {
    pub phase: u8,
    pub bet: u256,
    pub stack: u256,
    pub draw_index: u32,
    pub shoe_commitment: felt252,
    pub hole_hidden: bool,
    pub player_len: u8,
    pub dealer_len: u8,
}

#[derive(Copy, Drop, Serde)]
pub struct SeasonView {
    pub season_id: u64,
    pub start_ts: u64,
    pub end_ts: u64,
    pub open: bool,
    pub live: bool,
    pub player_count: u32,
}

#[derive(Copy, Drop, Serde)]
pub struct LeaderEntry {
    pub player: ContractAddress,
    pub volume: u256,
    pub hands: u32,
}

#[starknet::interface]
pub trait IBlackjackGame<TContractState> {
    fn buy_in(ref self: TContractState, amount: u256);
    fn deal(ref self: TContractState, bet: u256);
    fn hit(ref self: TContractState, hand_index: u8);
    fn stand(ref self: TContractState, hand_index: u8);
    fn double(ref self: TContractState, hand_index: u8);
    fn split(ref self: TContractState, hand_index: u8);
    fn insurance(ref self: TContractState);
    fn settle(ref self: TContractState);
    fn set_wager_war(ref self: TContractState, war: ContractAddress);
    fn shoe_commitment(self: @TContractState) -> felt252;
    fn get_stack(self: @TContractState, player: ContractAddress) -> u256;
    fn get_round(self: @TContractState, player: ContractAddress) -> RoundView;
    fn get_player_card(self: @TContractState, player: ContractAddress, index: u8) -> u8;
    fn get_dealer_card(self: @TContractState, player: ContractAddress, index: u8) -> u8;
    fn seed(self: @TContractState) -> felt252;
    fn wager_war(self: @TContractState) -> ContractAddress;
    fn owner(self: @TContractState) -> ContractAddress;
}

#[starknet::interface]
pub trait IWagerWar<TContractState> {
    fn set_game(ref self: TContractState, game: ContractAddress);
    fn open_season(ref self: TContractState, start_ts: u64, end_ts: u64);
    fn close_season(ref self: TContractState);
    /// Called only by the linked BlackjackGame. `new_hand` increments hand count.
    fn record_wager(ref self: TContractState, player: ContractAddress, amount: u256, new_hand: bool);
    fn get_season(self: @TContractState) -> SeasonView;
    fn get_volume(self: @TContractState, season_id: u64, player: ContractAddress) -> u256;
    fn get_hands(self: @TContractState, season_id: u64, player: ContractAddress) -> u32;
    fn get_player_count(self: @TContractState, season_id: u64) -> u32;
    fn get_player_at(self: @TContractState, season_id: u64, index: u32) -> ContractAddress;
    fn get_top(self: @TContractState, season_id: u64, limit: u32) -> Array<LeaderEntry>;
    fn owner(self: @TContractState) -> ContractAddress;
    fn game(self: @TContractState) -> ContractAddress;
}

#[starknet::interface]
pub trait IPrivacyInvoke<TContractState> {
    /// Privacy-preserving entry — Phase 4. Payload encoding TBD with note schema.
    fn privacy_invoke(ref self: TContractState, selector: felt252, payload: Array<felt252>);
}
