# Innovation upsides (hackathon)

Ways to raise the **Innovation (25%)** score beyond “another on-chain blackjack.”

## Ship soon (high leverage)

1. **Public shoe verifier page**  
   Paste `shoe_id` / commitment + reveal openings; anyone re-checks hole cards against the commitment without trusting the UI. Makes “provably fair” *demonstrable*.

2. **VRF (or commit–reveal) shoe seed**  
   Replace constructor public seed so the house cannot grind favorable shoes. Publish the VRF proof next to the commitment.

3. **Live STRK20 round-trip demo**  
   One button: shield → private buy-in → play one hand → private cash-out, with explorer links. Depth + innovation together.

4. **Shadow-account seat**  
   Table actions from a deterministic stealth account while chips are funded privately — unlinkable public play.

## Product-shaped differentiators

5. **Sealed-deal UX as a protocol guarantee**  
   Document + enforce “no face until receipt” in the verifier (already UX); add a light client proof that the sealed hash matches post-tx cards.

6. **Wager War with on-chain claimable pot**  
   Vault skim → season winners claim STRK. Volume wars exist elsewhere; *private* volume into a public pot is rarer.

7. **Cross-game volume**  
   Same WagerWar hook for a second mini-game (dice/roulette stub) — platform thesis, not a single table.

## Research / stretch

8. **Selective disclosure of a single hand**  
   Player proves “I won this shoe hand” to a third party without revealing all notes (compliance-friendly bragging).

9. **Paymaster + session key shoe**  
   One signature at buy-in; gasless hit/stand for the rest of the shoe (AA story judges notice).

9b. **Table operator / pre-deposit (shipped path)**  
   Player `approve` + `deposit_strk` + `set_operator(relayer)` once; house relayer submits `deal_for` / `hit_for` / … without further wallet popups. Operator cannot cash out.

10. **Open verifier CLI**  
    `npx starkbet21 verify --commitment 0x… --reveals …` for auditors and journalists.

## What *not* to chase for this sprint

- Full mental-poker multiplayer crypto  
- Token launch / DAO votes before a playable mainnet loop  
- Re-skinning without a new trust or privacy property  

**Recommended combo for judges:** (1) verifier page + (3) live private buy-in demo + (2) VRF note in the README as the fairness end-state.
