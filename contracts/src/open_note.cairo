//! STRK20 open-note deposit layout — must match `privacy::objects::OpenNoteDeposit`
//! so the pool can deserialize our `privacy_invoke` return value.

use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
pub struct OpenNoteDeposit {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}
