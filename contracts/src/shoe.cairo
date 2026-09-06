//! Shoe commitment + deterministic draw — Phase 2 (localnet V0).
//! Seed model (V1): VRF-sourced later; constructor seed for localnet.

use core::poseidon::poseidon_hash_span;

/// Number of cards in a single deck.
pub const DECK_SIZE: u32 = 52;

fn mix(state: felt252, salt: felt252) -> felt252 {
    poseidon_hash_span(array![state, salt].span())
}

/// LCG-ish step from Poseidon; returns new state and a u32 in `[0, bound)`.
fn next_u32(state: felt252, bound: u32) -> (felt252, u32) {
    let next = mix(state, bound.into());
    let as_u256: u256 = next.into();
    let b: u256 = bound.into();
    let r: u32 = (as_u256 % b).try_into().unwrap();
    (next, r)
}

/// Deterministic Fisher–Yates shuffle of a 52-card shoe from `seed`.
/// Card ids: `0..51` where `rank = id % 13 + 1`, `suit = id / 13`.
pub fn shuffled_order(seed: felt252) -> Array<u8> {
    let mut deck: Array<u8> = array![];
    let mut i: u8 = 0;
    while i < 52_u8 {
        deck.append(i);
        i += 1;
    }

    let mut state = mix(seed, 'shoe_v0');
    let mut n: u32 = DECK_SIZE;
    while n > 1 {
        n -= 1;
        let (s2, j) = next_u32(state, n + 1);
        state = s2;
        let a = *deck.at(n);
        let b = *deck.at(j);
        deck = set_at(deck, n, b);
        deck = set_at(deck, j, a);
    }
    deck
}

fn set_at(mut arr: Array<u8>, index: u32, value: u8) -> Array<u8> {
    let mut out: Array<u8> = array![];
    let mut i: u32 = 0;
    let len = arr.len();
    while i < len {
        if i == index {
            out.append(value);
        } else {
            out.append(*arr.at(i));
        }
        i += 1;
    }
    out
}

pub fn commit_shoe(seed: felt252, n_decks: u32) -> felt252 {
    assert(n_decks == 1, 'v0 single deck');
    let order = shuffled_order(seed);
    let mut acc: Array<felt252> = array!['shoe_commit'];
    let mut i: u32 = 0;
    while i < order.len() {
        acc.append((*order.at(i)).into());
        i += 1;
    }
    poseidon_hash_span(acc.span())
}

pub fn draw_card(seed: felt252, n_decks: u32, index: u32) -> u8 {
    assert(n_decks == 1, 'v0 single deck');
    assert(index < DECK_SIZE, 'draw OOB');
    let order = shuffled_order(seed);
    *order.at(index)
}

pub fn verify_open(commitment: felt252, index: u32, card: u8, seed: felt252) -> bool {
    let expected = draw_card(seed, 1, index);
    commitment == commit_shoe(seed, 1) && card == expected
}

/// Unpack card id `0..51` into rank (1–13) and suit (0–3).
pub fn unpack_card(id: u8) -> (u8, u8) {
    let rank = (id % 13_u8) + 1_u8;
    let suit = id / 13_u8;
    (rank, suit)
}
