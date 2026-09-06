/** Note decryption + channel key handling — Phase 3 / 7.
 * Must match contracts/src/note.cairo packing bit-for-bit.
 */

export type CardNote = {
  rank: number;
  suit: number;
  handIndex: number;
  shoeId: string;
  recipientChannelKey: string;
  nonce: string;
};

export function decryptCardNote(
  _ciphertext: string[],
  _channelSecret: string,
): CardNote | null {
  // TODO(Phase 3): shared fixtures with Cairo
  return null;
}
