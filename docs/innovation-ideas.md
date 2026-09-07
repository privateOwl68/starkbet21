# Innovation upsides (hackathon)

Ways to raise the **Innovation (25%)** score beyond “another on-chain blackjack.”

See also [`hackathon-scorecard.md`](./hackathon-scorecard.md) for full rubric weights.

## Shipped (credit these in the pitch)

| Idea | Status | Judge line |
|------|--------|------------|
| Sealed-deal UX | Live | Cards stay face-down until tx receipt — fairness *felt*, not only claimed |
| Shoe commitment on-chain | Live (mainnet + Sepolia) | Deterministic draw order from published commitment |
| STRK20 anonymizer buy-in / cash-out | Live contracts + Wallet API UI | Private STRK → table chips without public funding graph |
| Gasless table via operator `*_for` | Live | One authorize; house relayer plays; cannot cash out |
| Wager War volume seasons | Live | On-chain volume rank / XP badges |
| Free mint gated when vault set | Live | Mainnet = STRK collateral only |

## Ship next (highest Innovation leverage)

1. **Public shoe verifier page / CLI**  
   Paste commitment + reveal openings; anyone re-checks hole cards without trusting the UI. Makes “provably fair” *demonstrable*. **Top Innovation gap.**

2. **VRF (or commit–reveal) shoe seed**  
   Replace constructor public seed so the house cannot grind favorable shoes. Publish the VRF proof next to the commitment. Document as end-state even if stub lands first.

3. **Live mainnet STRK20 round-trip clip**  
   Shield → private buy-in → one hand → private cash-out with Voyager links. Depth + innovation together.

4. **Shadow-account seat**  
   Table actions from a deterministic stealth account while chips are funded privately — unlinkable public play (STRK20 depth + novelty).

## Product-shaped differentiators (after verifier)

5. **Sealed-deal as a protocol guarantee**  
   Light client check that sealed hash matches post-tx cards (already UX; add verifier hook).

6. **Wager War with on-chain claimable pot**  
   Vault skim → season winners claim STRK. Volume wars exist; *private* volume into a public pot is rarer.

7. **Cross-game volume**  
   Same WagerWar hook for a second mini-game stub — platform thesis, not a single table.

## Research / stretch

8. **Selective disclosure of a single hand**  
   Player proves “I won this shoe hand” without revealing all notes.

9. **Paymaster + session-key shoe**  
   Protocol-native gasless (beyond house operator relayer).

10. **Open verifier CLI**  
    `npx starkbet21 verify --commitment 0x… --reveals …` for auditors and journalists.

## What *not* to chase for this sprint

- Full mental-poker multiplayer crypto  
- Token launch / DAO votes before a playable mainnet loop + soak  
- Re-skinning without a new trust or privacy property  

**Recommended combo for judges:** (1) verifier page + (3) live private buy-in demo on **mainnet** + (2) VRF note in the README as the fairness end-state + operator gasless already shipped.
