//! WagerWar — time-boxed volume leaderboard seasons (points/badges V1, no token prizes).

#[starknet::contract]
mod wager_war {
    use crate::interfaces::{IWagerWar, LeaderEntry, SeasonView};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};

    #[storage]
    struct Storage {
        owner: ContractAddress,
        game: ContractAddress,
        season_id: u64,
        start_ts: u64,
        end_ts: u64,
        season_open: bool,
        volume: Map<(u64, ContractAddress), u256>,
        hands: Map<(u64, ContractAddress), u32>,
        /// 0 = not joined; else index + 1 into `players`.
        player_slot: Map<(u64, ContractAddress), u32>,
        players: Map<(u64, u32), ContractAddress>,
        player_count: Map<u64, u32>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.season_id.write(0);
        self.season_open.write(false);
    }

    #[abi(embed_v0)]
    impl WagerWarImpl of IWagerWar<ContractState> {
        fn set_game(ref self: ContractState, game: ContractAddress) {
            self.assert_owner();
            self.game.write(game);
        }

        fn open_season(ref self: ContractState, start_ts: u64, end_ts: u64) {
            self.assert_owner();
            assert(end_ts > start_ts, 'bad window');
            let next = self.season_id.read() + 1;
            self.season_id.write(next);
            self.start_ts.write(start_ts);
            self.end_ts.write(end_ts);
            self.season_open.write(true);
            self.player_count.write(next, 0);
        }

        fn close_season(ref self: ContractState) {
            self.assert_owner();
            self.season_open.write(false);
        }

        fn record_wager(
            ref self: ContractState, player: ContractAddress, amount: u256, new_hand: bool,
        ) {
            assert(get_caller_address() == self.game.read(), 'only game');
            assert(amount > 0, 'amount=0');
            assert(self.is_live(), 'season not live');

            let sid = self.season_id.read();
            let key = (sid, player);
            let prev = self.volume.read(key);
            self.volume.write(key, prev + amount);

            if new_hand {
                self.hands.write(key, self.hands.read(key) + 1);
            }

            if self.player_slot.read(key) == 0 {
                let idx = self.player_count.read(sid);
                self.players.write((sid, idx), player);
                self.player_slot.write(key, idx + 1);
                self.player_count.write(sid, idx + 1);
            }
        }

        fn get_season(self: @ContractState) -> SeasonView {
            let sid = self.season_id.read();
            SeasonView {
                season_id: sid,
                start_ts: self.start_ts.read(),
                end_ts: self.end_ts.read(),
                open: self.season_open.read(),
                live: self.is_live(),
                player_count: self.player_count.read(sid),
            }
        }

        fn get_volume(self: @ContractState, season_id: u64, player: ContractAddress) -> u256 {
            self.volume.read((season_id, player))
        }

        fn get_hands(self: @ContractState, season_id: u64, player: ContractAddress) -> u32 {
            self.hands.read((season_id, player))
        }

        fn get_player_count(self: @ContractState, season_id: u64) -> u32 {
            self.player_count.read(season_id)
        }

        fn get_player_at(self: @ContractState, season_id: u64, index: u32) -> ContractAddress {
            assert(index < self.player_count.read(season_id), 'oob');
            self.players.read((season_id, index))
        }

        fn get_top(self: @ContractState, season_id: u64, limit: u32) -> Array<LeaderEntry> {
            let n = self.player_count.read(season_id);
            let mut entries: Array<LeaderEntry> = array![];
            let mut i: u32 = 0;
            while i < n {
                let player = self.players.read((season_id, i));
                entries
                    .append(
                        LeaderEntry {
                            player,
                            volume: self.volume.read((season_id, player)),
                            hands: self.hands.read((season_id, player)),
                        },
                    );
                i += 1;
            }

            let len = entries.len();
            let take_n = if limit == 0 || limit > len {
                len
            } else {
                limit
            };

            let mut sorted: Array<LeaderEntry> = array![];
            let mut taken: Array<bool> = array![];
            let mut t: u32 = 0;
            while t < len {
                taken.append(false);
                t += 1;
            }

            let mut k: u32 = 0;
            while k < take_n {
                let mut best_i: u32 = 0;
                let mut found = false;
                let mut j: u32 = 0;
                while j < len {
                    if !*taken.at(j) {
                        if !found || *entries.at(j).volume > *entries.at(best_i).volume {
                            best_i = j;
                            found = true;
                        }
                    }
                    j += 1;
                }
                if found {
                    sorted.append(*entries.at(best_i));
                    let mut new_taken: Array<bool> = array![];
                    let mut m: u32 = 0;
                    while m < len {
                        if m == best_i {
                            new_taken.append(true);
                        } else {
                            new_taken.append(*taken.at(m));
                        }
                        m += 1;
                    }
                    taken = new_taken;
                }
                k += 1;
            }
            sorted
        }

        fn owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn game(self: @ContractState) -> ContractAddress {
            self.game.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_owner(self: @ContractState) {
            assert(get_caller_address() == self.owner.read(), 'only owner');
        }

        fn is_live(self: @ContractState) -> bool {
            if !self.season_open.read() {
                return false;
            }
            if self.season_id.read() == 0 {
                return false;
            }
            let now = get_block_timestamp();
            let start = self.start_ts.read();
            let end = self.end_ts.read();
            now >= start && now < end
        }
    }
}
