//! Payout math — Phase 4 wiring; pure helpers can land earlier.
//! Blackjack 3:2, insurance, splits, doubles.

pub fn blackjack_payout(bet: u256) -> u256 {
    // 3:2 on the bet, returning stake + winnings = 2.5x bet
    bet + (bet * 3) / 2
}

pub fn even_money_win(bet: u256) -> u256 {
    bet * 2
}

pub fn push_return(bet: u256) -> u256 {
    bet
}

pub fn insurance_win(insurance_bet: u256) -> u256 {
    // Insurance pays 2:1
    insurance_bet * 3
}

pub fn lose(_bet: u256) -> u256 {
    0
}
