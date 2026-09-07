import {
  Account,
  CallData,
  Contract,
  RpcProvider,
  cairo,
  type AccountInterface,
  type Call,
  type RawArgs,
} from "starknet";
import abi from "./blackjack_abi.json";
import { getDeployment, resolveRpcUrl, type Deployment } from "./deployment";
import { makeCard, type Card } from "./hand";
import { SEPOLIA_STRK } from "./strk20";

export type ChainRound = {
  phase: number;
  bet: bigint;
  stack: bigint;
  drawIndex: number;
  shoeCommitment: string;
  holeHidden: boolean;
  playerLen: number;
  dealerLen: number;
};

export type ChainSnapshot = {
  round: ChainRound;
  player: Card[];
  dealer: Card[];
  address: string;
  commitment: string;
};

const PHASE_IDLE = 0;
const PHASE_PLAYER = 1;
const PHASE_DONE = 2;

export { PHASE_IDLE, PHASE_PLAYER, PHASE_DONE };

function asBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") return BigInt(v);
  if (v && typeof v === "object" && "low" in (v as object)) {
    const u = v as { low: bigint | string | number; high: bigint | string | number };
    return BigInt(u.low) + (BigInt(u.high) << 128n);
  }
  return BigInt(String(v));
}

function asNumber(v: unknown): number {
  return Number(asBigInt(v));
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "object" && v !== null && "variant" in (v as object)) {
    const variant = (v as { variant: Record<string, unknown> }).variant;
    return "True" in variant || "true" in variant;
  }
  return Boolean(Number(v));
}

function asAddress(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return `0x${asBigInt(v).toString(16)}`;
  } catch {
    return String(v);
  }
}

export function cardFromId(id: number): Card {
  const rank = (id % 13) + 1;
  const suit = Math.floor(id / 13);
  return makeCard(rank, suit);
}

export type GameClientOpts = {
  /** Signer for play txs — player wallet, or relayer when authorized. */
  account: AccountInterface;
  playerAddress: string;
  deployment?: Deployment;
  /** When true, play calls use *_for(player, …) via the signer (relayer). */
  relayPlay?: boolean;
};

/** Optional in-browser demo relayer (Sepolia only — prefer a backend in production). */
function envFelt(name: string): string | undefined {
  const raw = (import.meta.env[name] as string | undefined)?.trim();
  if (!raw) return undefined;
  // Strip inline comments: 0xabc… # note
  const cleaned = raw.split(/\s+#/)[0]?.trim() || raw.trim();
  return cleaned || undefined;
}

export function createRelayerAccount(deployment?: Deployment): Account | null {
  const d = deployment ?? getDeployment();
  const pk = envFelt("VITE_RELAYER_PRIVATE_KEY");
  const addr = envFelt("VITE_RELAYER_ADDRESS") || d.tableRelayer?.trim();
  if (!pk || !addr || addr.includes("REPLACE")) return null;
  try {
    const provider = new RpcProvider({
      nodeUrl: resolveRpcUrl(d),
      blockIdentifier: "latest",
    });
    return new Account({ provider, address: addr, signer: pk });
  } catch {
    return null;
  }
}

export function resolveTableRelayer(deployment?: Deployment): string | null {
  const d = deployment ?? getDeployment();
  // Prefer the address we can actually sign as (env), else on-chain default from deploy.
  const addr = envFelt("VITE_RELAYER_ADDRESS") || d.tableRelayer?.trim();
  if (!addr || addr.includes("REPLACE")) return null;
  return addr;
}

export function isRelayerConfigured(deployment?: Deployment): boolean {
  return createRelayerAccount(deployment) != null;
}

/** Read-only stack lookup (lobby / header meters — no wallet signature). */
export async function fetchTableStack(
  playerAddress: string,
  deployment?: Deployment,
): Promise<bigint> {
  const d = deployment ?? getDeployment();
  if (!d.blackjackGame || d.blackjackGame.includes("REPLACE") || !playerAddress) {
    return 0n;
  }
  const provider = new RpcProvider({
    nodeUrl: resolveRpcUrl(d),
    blockIdentifier: "latest",
  });
  const contract = new Contract({
    abi: abi as never,
    address: d.blackjackGame,
    providerOrAccount: provider,
  });
  return asBigInt(await contract.get_stack(playerAddress));
}

export function createGameClient(opts: GameClientOpts) {
  const deployment = opts.deployment ?? getDeployment();
  if (!deployment.blackjackGame || deployment.blackjackGame.includes("REPLACE")) {
    throw new Error("Blackjack not deployed — run deploy_local.sh or deploy_sepolia.sh");
  }

  const provider = new RpcProvider({
    nodeUrl: resolveRpcUrl(deployment),
    blockIdentifier: "latest",
  });
  const account = opts.account;
  const player = opts.playerAddress;
  const relayPlay = Boolean(opts.relayPlay);
  const contract = new Contract({
    abi: abi as never,
    address: deployment.blackjackGame,
    providerOrAccount: account,
  });
  const readContract = new Contract({
    abi: abi as never,
    address: deployment.blackjackGame,
    providerOrAccount: provider,
  });

  async function wait(hash: string) {
    await provider.waitForTransaction(hash);
  }

  async function invoke(fn: string, args: RawArgs = []) {
    const call = contract.populate(fn, args) as Call;
    const { transaction_hash } = await account.execute(call, { tip: 0n });
    await wait(transaction_hash);
    return transaction_hash;
  }

  async function getRound(): Promise<ChainRound> {
    const raw = (await readContract.get_round(player)) as Record<string, unknown> & unknown[];
    return {
      phase: asNumber(raw.phase ?? raw[0]),
      bet: asBigInt(raw.bet ?? raw[1]),
      stack: asBigInt(raw.stack ?? raw[2]),
      drawIndex: asNumber(raw.draw_index ?? raw[3]),
      shoeCommitment: String(raw.shoe_commitment ?? raw[4]),
      holeHidden: asBool(raw.hole_hidden ?? raw[5]),
      playerLen: asNumber(raw.player_len ?? raw[6]),
      dealerLen: asNumber(raw.dealer_len ?? raw[7]),
    };
  }

  async function getCards(kind: "player" | "dealer", len: number): Promise<Card[]> {
    const out: Card[] = [];
    for (let i = 0; i < len; i++) {
      const id =
        kind === "player"
          ? asNumber(await readContract.get_player_card(player, i))
          : asNumber(await readContract.get_dealer_card(player, i));
      out.push(cardFromId(id));
    }
    return out;
  }

  async function snapshot(): Promise<ChainSnapshot> {
    const round = await getRound();
    const [playerCards, dealer] = await Promise.all([
      getCards("player", round.playerLen),
      getCards("dealer", round.dealerLen),
    ]);
    return {
      round,
      player: playerCards,
      dealer,
      address: player,
      commitment: String(round.shoeCommitment),
    };
  }

  async function getOperator(): Promise<string> {
    try {
      return asAddress(await readContract.get_operator(player));
    } catch {
      return "0x0";
    }
  }

  async function getDefaultRelayer(): Promise<string> {
    try {
      return asAddress(await readContract.default_relayer());
    } catch {
      return resolveTableRelayer(deployment) ?? "0x0";
    }
  }

  return {
    deployment,
    account,
    contract,
    playerAddress: player,
    relayPlay,
    async ensureBuyIn(amount = 1000n) {
      const round = await getRound();
      if (round.stack === 0n && round.phase === PHASE_IDLE) {
        await invoke("buy_in", [cairo.uint256(amount)]);
      }
    },
    async buyIn(amount: bigint) {
      await invoke("buy_in", [cairo.uint256(amount)]);
    },
    async approveStrk(amount: bigint, token = SEPOLIA_STRK) {
      const call: Call = {
        contractAddress: token,
        entrypoint: "approve",
        calldata: CallData.compile({
          spender: deployment.blackjackGame,
          amount: cairo.uint256(amount),
        }),
      };
      const { transaction_hash } = await account.execute(call, { tip: 0n });
      await wait(transaction_hash);
      return transaction_hash;
    },
    /** Approve STRK + deposit into table chips in one wallet confirmation when possible. */
    async approveAndDepositStrk(amount: bigint, token = SEPOLIA_STRK) {
      let vaultToken = token;
      try {
        const onChain = asAddress(await readContract.strk_token());
        if (onChain && onChain !== "0x0") vaultToken = onChain;
      } catch {
        /* use default */
      }
      if (!vaultToken || vaultToken === "0x0") {
        throw new Error("Game vault STRK token unset — redeploy with set_strk_vault");
      }
      const approveCall: Call = {
        contractAddress: vaultToken,
        entrypoint: "approve",
        calldata: CallData.compile({
          spender: deployment.blackjackGame,
          amount: cairo.uint256(amount),
        }),
      };
      const depositCall = contract.populate("deposit_strk", [cairo.uint256(amount)]) as Call;
      const { transaction_hash } = await account.execute([approveCall, depositCall], { tip: 0n });
      await wait(transaction_hash);
      return transaction_hash;
    },
    async depositStrk(amount: bigint) {
      await invoke("deposit_strk", [cairo.uint256(amount)]);
    },
    async supportsChipDeposit(): Promise<boolean> {
      try {
        const token = asAddress(await readContract.strk_token());
        return Boolean(token && token !== "0x0");
      } catch {
        return false;
      }
    },
    async setOperator(operator: string) {
      await invoke("set_operator", [operator]);
    },
    async clearOperator() {
      await invoke("clear_operator", []);
    },
    getOperator,
    getDefaultRelayer,
    async deal(bet: bigint) {
      if (relayPlay) await invoke("deal_for", [player, cairo.uint256(bet)]);
      else await invoke("deal", [cairo.uint256(bet)]);
    },
    async hit() {
      if (relayPlay) await invoke("hit_for", [player, 0]);
      else await invoke("hit", [0]);
    },
    async stand() {
      if (relayPlay) await invoke("stand_for", [player, 0]);
      else await invoke("stand", [0]);
    },
    async double() {
      if (relayPlay) await invoke("double_for", [player, 0]);
      else await invoke("double", [0]);
    },
    async settle() {
      if (relayPlay) await invoke("settle_for", [player]);
      else await invoke("settle", []);
    },
    getRound,
    snapshot,
  };
}

/** @deprecated Prefer createGameClient + wallet. Localnet demo helper. */
export function createLocalnetClient() {
  const deployment = getDeployment();
  if (!deployment.accountAddress || !deployment.accountPrivateKey) {
    throw new Error("Localnet demo account missing");
  }
  const provider = new RpcProvider({
    nodeUrl: resolveRpcUrl(deployment),
    blockIdentifier: "latest",
  });
  const account = new Account({
    provider,
    address: deployment.accountAddress,
    signer: deployment.accountPrivateKey,
  });
  return createGameClient({
    account,
    playerAddress: deployment.accountAddress,
    deployment,
  });
}

export type LocalnetClient = ReturnType<typeof createGameClient>;
export type GameClient = ReturnType<typeof createGameClient>;
