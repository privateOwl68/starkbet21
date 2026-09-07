//! Minimal mintable ERC-20 for anonymizer tests.

#[starknet::interface]
pub trait IMockErc20<TContractState> {
    fn mint(ref self: TContractState, to: starknet::ContractAddress, amount: u256);
}

#[starknet::contract]
pub mod mock_erc20 {
    use crate::erc20::IERC20;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use super::IMockErc20;

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl MockMint of IMockErc20<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            let bal = self.balances.read(to);
            self.balances.write(to, bal + amount);
        }
    }

    #[abi(embed_v0)]
    impl ERC20Impl of IERC20<ContractState> {
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = get_caller_address();
            let from_bal = self.balances.read(sender);
            assert(from_bal >= amount, 'insufficient');
            self.balances.write(sender, from_bal - amount);
            let to_bal = self.balances.read(recipient);
            self.balances.write(recipient, to_bal + amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let owner = get_caller_address();
            self.allowances.write((owner, spender), amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let spender = get_caller_address();
            let allowed = self.allowances.read((sender, spender));
            assert(allowed >= amount, 'allowance');
            self.allowances.write((sender, spender), allowed - amount);
            let from_bal = self.balances.read(sender);
            assert(from_bal >= amount, 'insufficient');
            self.balances.write(sender, from_bal - amount);
            let to_bal = self.balances.read(recipient);
            self.balances.write(recipient, to_bal + amount);
            true
        }
    }
}
