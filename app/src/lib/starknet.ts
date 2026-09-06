/** Starknet provider, account, and session-key setup — Phase 6 / 7. */

export type NetworkId = "devnet" | "sepolia" | "mainnet";

export function getRpcUrl(network: NetworkId = "devnet"): string {
  switch (network) {
    case "sepolia":
      return "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";
    case "mainnet":
      return "https://starknet-mainnet.public.blastapi.io/rpc/v0_7";
    default:
      return "http://127.0.0.1:5050";
  }
}

// TODO(Phase 6): session key scoping — game actions only, no stack withdraw.
export async function connectAccount(): Promise<null> {
  return null;
}
