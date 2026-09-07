/** Network deployment config — never ship private keys for Sepolia/mainnet. */

import localDeploy from "./deployments.local.json";
import sepoliaDeploy from "./deployments.sepolia.json";

export type NetworkName = "localnet" | "sepolia" | "mainnet";

export type Deployment = {
  network: string;
  rpcUrl: string;
  chainId: string;
  blackjackGame: string;
  wagerWar?: string;
  anonymizer?: string;
  classHash?: string;
  wagerWarClassHash?: string;
  anonymizerClassHash?: string;
  shoeSeed?: string | number;
  warStartTs?: number;
  warEndTs?: number;
  /** Localnet demo only — omit on public nets. */
  accountAddress?: string;
  accountPrivateKey?: string;
  /** House table relayer players authorize for gasless play. */
  tableRelayer?: string;
  note?: string;
};

export function activeNetwork(): NetworkName {
  const n = (import.meta.env.VITE_NETWORK as string | undefined)?.toLowerCase();
  if (n === "sepolia" || n === "mainnet" || n === "localnet") return n;
  return "localnet";
}

export function getDeployment(): Deployment {
  const network = activeNetwork();
  if (network === "sepolia" || network === "mainnet") {
    return sepoliaDeploy as Deployment;
  }
  return localDeploy as Deployment;
}

export function resolveRpcUrl(d: Deployment = getDeployment()): string {
  if (typeof window === "undefined" && d.rpcUrl.startsWith("/")) {
    return "http://127.0.0.1:5051";
  }
  return d.rpcUrl;
}

export function isPublicNetwork(d: Deployment = getDeployment()): boolean {
  const n = activeNetwork();
  return n === "sepolia" || n === "mainnet" || d.network === "sepolia" || d.network === "mainnet";
}

export function shortAddress(a: string) {
  if (!a || a.length < 12) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
