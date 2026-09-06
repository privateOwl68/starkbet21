use shoe::settlement::{blackjack_payout, even_money_win, insurance_win, lose, push_return};

#[test]
fn blackjack_pays_three_to_two() {
    let bet: u256 = 100;
    assert(blackjack_payout(bet) == 250, '3:2');
}

#[test]
fn even_money() {
    assert(even_money_win(50) == 100, '1:1');
}

#[test]
fn push() {
    assert(push_return(75) == 75, 'push');
}

#[test]
fn insurance_two_to_one() {
    assert(insurance_win(10) == 30, 'ins 2:1');
}

#[test]
fn loss_zero() {
    assert(lose(100) == 0, 'lose');
}
