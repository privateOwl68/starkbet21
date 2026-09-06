use shoe::shoe::{commit_shoe, draw_card, shuffled_order, unpack_card, verify_open};

#[test]
fn commit_is_deterministic() {
    let a = commit_shoe(123, 1);
    let b = commit_shoe(123, 1);
    assert(a == b, 'same seed same commit');
}

#[test]
fn different_seeds_differ() {
    let a = commit_shoe(1, 1);
    let b = commit_shoe(2, 1);
    assert(a != b, 'diff seeds');
}

#[test]
fn draw_stable() {
    let c0 = draw_card(99, 1, 0);
    let c0b = draw_card(99, 1, 0);
    assert(c0 == c0b, 'stable draw');
}

#[test]
fn shuffled_is_permutation() {
    let order = shuffled_order(7);
    assert(order.len() == 52, 'len 52');
    let mut i: u32 = 0;
    while i < 52 {
        let mut count: u32 = 0;
        let mut j: u32 = 0;
        while j < 52 {
            if *order.at(j) == i.try_into().unwrap() {
                count += 1;
            }
            j += 1;
        }
        assert(count == 1, 'not perm');
        i += 1;
    }
}

#[test]
fn verify_open_matches_draw() {
    let seed = 42;
    let commitment = commit_shoe(seed, 1);
    let card = draw_card(seed, 1, 3);
    assert(verify_open(commitment, 3, card, seed), 'open ok');
}

#[test]
fn unpack_ace_of_clubs() {
    let (rank, suit) = unpack_card(0);
    assert(rank == 1, 'ace');
    assert(suit == 0, 'clubs');
}
