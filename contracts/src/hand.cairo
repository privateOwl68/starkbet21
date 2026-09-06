//! Hand scoring and split bookkeeping — Phase 1.
//! Pure functions only: no storage, no privacy, no chain.

/// Rank: 1 = Ace, 2–10 = pip, 11 = Jack, 12 = Queen, 13 = King.
#[derive(Copy, Drop, Serde, PartialEq)]
pub struct Card {
    pub rank: u8,
    pub suit: u8,
}

#[derive(Copy, Drop, Serde, PartialEq)]
pub struct HandValue {
    pub total: u8,
    pub soft: bool,
}

/// Soft/hard total for a hand. Aces count as 11 when possible without busting.
pub fn hand_value(cards: Span<Card>) -> HandValue {
    let mut total: u16 = 0;
    let mut aces: u16 = 0;
    let mut i: usize = 0;
    while i < cards.len() {
        let c = *cards.at(i);
        if c.rank == 1 {
            aces += 1;
            total += 1;
        } else if c.rank >= 10 {
            total += 10;
        } else {
            total += c.rank.into();
        }
        i += 1;
    }

    let mut soft = false;
    if aces > 0 && total + 10 <= 21 {
        total += 10;
        soft = true;
    }

    HandValue { total: total.try_into().unwrap(), soft }
}

pub fn is_bust(cards: Span<Card>) -> bool {
    hand_value(cards).total > 21
}

/// Natural blackjack: exactly two cards totaling 21 (not after split — caller gates that).
pub fn is_blackjack(cards: Span<Card>) -> bool {
    cards.len() == 2 && hand_value(cards).total == 21
}

/// Dealer H17: hit soft 17. Document in PLAN / RFP — V1 default = H17.
pub fn dealer_should_hit(cards: Span<Card>, hit_soft_17: bool) -> bool {
    let v = hand_value(cards);
    if v.total < 17 {
        return true;
    }
    if hit_soft_17 && v.soft && v.total == 17 {
        return true;
    }
    false
}
