use shoe::hand::{Card, dealer_should_hit, hand_value, is_blackjack, is_bust};

fn c(rank: u8, suit: u8) -> Card {
    Card { rank, suit }
}

#[test]
fn hard_total_simple() {
    let cards = array![c(10, 0), c(7, 1)].span();
    let v = hand_value(cards);
    assert(v.total == 17, 'hard 17');
    assert(!v.soft, 'not soft');
}

#[test]
fn soft_ace_plus_six() {
    let cards = array![c(1, 0), c(6, 1)].span();
    let v = hand_value(cards);
    assert(v.total == 17, 'soft 17');
    assert(v.soft, 'soft');
}

#[test]
fn ace_revalues_on_hit() {
    let cards = array![c(1, 0), c(6, 1), c(10, 2)].span();
    let v = hand_value(cards);
    assert(v.total == 17, 'hard 17 after ace drop');
    assert(!v.soft, 'not soft');
}

#[test]
fn natural_blackjack() {
    let cards = array![c(1, 0), c(10, 1)].span();
    assert(is_blackjack(cards), 'bj');
    assert(!is_bust(cards), 'not bust');
}

#[test]
fn bust_detection() {
    let cards = array![c(10, 0), c(10, 1), c(5, 2)].span();
    assert(is_bust(cards), 'bust');
}

#[test]
fn dealer_h17_hits_soft_17() {
    let cards = array![c(1, 0), c(6, 1)].span();
    assert(dealer_should_hit(cards, true), 'H17 hit');
    assert(!dealer_should_hit(cards, false), 'S17 stand');
}

// TODO(Phase 1): expand to ~30+ cases — A-A splits, 21-after-split ≠ blackjack,
// double-after-split, push, multi-ace soft totals, face cards, etc.
