/** Network deployment config — never ship private keys for Sepolia/mainnet. */

import localDeploy from "./deployments.local.json";
import sepoliaDeploy from "./deployments.sepolia.json";
import mainnetDeploy from "./deployments.mainnet.json";

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

/** User-facing network name (Lobby eyebrow, wallet gate, etc.). */
export function networkDisplayName(network: string = activeNetwork()): string {
  switch (network.toLowerCase()) {
    case "mainnet":
      return "Mainnet";
    case "sepolia":
      return "Sepolia";
    case "localnet":
    case "devnet":
      return "Localnet";
    default:
      return network.charAt(0).toUpperCase() + network.slice(1);
  }
}

/** Deploy script hint for the active (or given) network. */
export function deployScriptHint(network: string = activeNetwork()): string {
  switch (network.toLowerCase()) {
    case "mainnet":
      return "./scripts/deploy_mainnet.sh";
    case "sepolia":
      return "./scripts/deploy_sepolia.sh";
    default:
      return "./scripts/deploy_local.sh";
  }
}

function isPlaceholderAddress(addr: string | undefined): boolean {
  if (!addr) return true;
  return /REPLACE/i.test(addr);
}

/** True when the active deployment has real contract addresses (not placeholders). */
export function isDeploymentReady(d: Deployment = getDeploymentUnsafe()): boolean {
  return !isPlaceholderAddress(d.blackjackGame);
}

function getDeploymentUnsafe(): Deployment {
  const network = activeNetwork();
  if (network === "mainnet") return mainnetDeploy as Deployment;
  if (network === "sepolia") return sepoliaDeploy as Deployment;
  return localDeploy as Deployment;
}

export function getDeployment(): Deployment {
  const network = activeNetwork();
  const d = getDeploymentUnsafe();
  if (network === "mainnet" && isPlaceholderAddress(d.blackjackGame)) {
    throw new Error(
      "Mainnet contracts not deployed yet — run ./scripts/deploy_mainnet.sh (ALLOW_MAINNET_DEPLOY=1), then restart the app with VITE_NETWORK=mainnet",
    );
  }
  if (network === "mainnet" && d.network !== "mainnet") {
    throw new Error("deployments.mainnet.json has wrong network field");
  }
  if (network === "sepolia" && d.network !== "sepolia") {
    throw new Error("deployments.sepolia.json has wrong network field");
  }
  return d;
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
