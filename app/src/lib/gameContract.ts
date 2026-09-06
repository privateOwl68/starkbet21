import { Account, Contract, RpcProvider, cairo, type Call, type RawArgs } from "starknet";
import abi from "./blackjack_abi.json";
import deployment from "./deployments.local.json";
import { makeCard, type Card } from "./hand";

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

/** Card id 0..51 → UI card */
export function cardFromId(id: number): Card {
  const rank = (id % 13) + 1;
  const suit = Math.floor(id / 13);
  return makeCard(rank, suit);
}

function rpcUrl(): string {
  // In the browser, same-origin /rpc avoids CORS (Vite proxies to :5051).
  // Outside the browser, hit the compatibility proxy directly.
  if (typeof window === "undefined" && deployment.rpcUrl.startsWith("/")) {
    return "http://127.0.0.1:5051";
  }
  return deployment.rpcUrl;
}

export function createLocalnetClient() {
  // Devnet 0.9 speaks RPC 0.10.x — needs starknet.js ≥ 10 (V3 + l1_data_gas).
  const provider = new RpcProvider({
    nodeUrl: rpcUrl(),
    blockIdentifier: "latest",
  });
  const account = new Account({
    provider,
    address: deployment.accountAddress,
    signer: deployment.accountPrivateKey,
  });
  const contract = new Contract({
    abi: abi as never,
    address: deployment.blackjackGame,
    providerOrAccount: account,
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
    const raw = (await contract.get_round(deployment.accountAddress)) as Record<string, unknown> &
      unknown[];
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
          ? asNumber(await contract.get_player_card(deployment.accountAddress, i))
          : asNumber(await contract.get_dealer_card(deployment.accountAddress, i));
      out.push(cardFromId(id));
    }
    return out;
  }

  async function snapshot(): Promise<ChainSnapshot> {
    const round = await getRound();
    const [player, dealer] = await Promise.all([
      getCards("player", round.playerLen),
      getCards("dealer", round.dealerLen),
    ]);
    return {
      round,
      player,
      dealer,
      address: deployment.accountAddress,
      commitment: String(round.shoeCommitment),
    };
  }

  return {
    deployment,
    account,
    contract,
    async ensureBuyIn(amount = 1000n) {
      const round = await getRound();
      if (round.stack === 0n && round.phase === PHASE_IDLE) {
        await invoke("buy_in", [cairo.uint256(amount)]);
      }
    },
    async buyIn(amount: bigint) {
      await invoke("buy_in", [cairo.uint256(amount)]);
    },
    async deal(bet: bigint) {
      await invoke("deal", [cairo.uint256(bet)]);
    },
    async hit() {
      await invoke("hit", [0]);
    },
    async stand() {
      await invoke("stand", [0]);
    },
    async double() {
      await invoke("double", [0]);
    },
    async settle() {
      await invoke("settle", []);
    },
    getRound,
    snapshot,
  };
}

export type LocalnetClient = ReturnType<typeof createLocalnetClient>;
