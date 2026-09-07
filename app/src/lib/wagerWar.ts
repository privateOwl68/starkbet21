import { Contract, RpcProvider } from "starknet";
import abi from "./wager_war_abi.json";
import { getDeployment, resolveRpcUrl } from "./deployment";
import { rewardsForRank, type WarReward } from "./warRewards";

export type SeasonInfo = {
  seasonId: number;
  startTs: number;
  endTs: number;
  open: boolean;
  live: boolean;
  playerCount: number;
};

export type LeaderRow = {
  rank: number;
  player: string;
  volume: bigint;
  hands: number;
  isYou: boolean;
};

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

function rpcUrl(): string {
  return resolveRpcUrl(getDeployment());
}

function shortAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function createWagerWarClient(youAddress?: string) {
  const deployment = getDeployment();
  const warAddress = deployment.wagerWar;
  if (!warAddress || warAddress.includes("REPLACE")) {
    throw new Error("wagerWar missing — run ./scripts/deploy_local.sh or deploy_sepolia.sh");
  }

  const provider = new RpcProvider({
    nodeUrl: rpcUrl(),
    blockIdentifier: "latest",
  });
  const contract = new Contract({
    abi: abi as never,
    address: warAddress,
    providerOrAccount: provider,
  });
  const you = youAddress ?? deployment.accountAddress ?? "";

  async function getSeason(): Promise<SeasonInfo> {
    const raw = (await contract.get_season()) as Record<string, unknown> & unknown[];
    return {
      seasonId: asNumber(raw.season_id ?? raw[0]),
      startTs: asNumber(raw.start_ts ?? raw[1]),
      endTs: asNumber(raw.end_ts ?? raw[2]),
      open: asBool(raw.open ?? raw[3]),
      live: asBool(raw.live ?? raw[4]),
      playerCount: asNumber(raw.player_count ?? raw[5]),
    };
  }

  async function getTop(limit = 50): Promise<LeaderRow[]> {
    const season = await getSeason();
    if (season.seasonId === 0) return [];
    const raw = (await contract.get_top(season.seasonId, limit)) as unknown[];
    return (raw ?? []).map((entry, i) => {
      const e = entry as Record<string, unknown> & unknown[];
      const player = String(e.player ?? e[0] ?? "");
      return {
        rank: i + 1,
        player,
        volume: asBigInt(e.volume ?? e[1]),
        hands: asNumber(e.hands ?? e[2]),
        isYou: player.toLowerCase() === you.toLowerCase(),
      };
    });
  }

  async function getMyStats(): Promise<{ volume: bigint; hands: number; rank: number | null }> {
    const season = await getSeason();
    if (season.seasonId === 0) return { volume: 0n, hands: 0, rank: null };
    const volume = asBigInt(await contract.get_volume(season.seasonId, you));
    const hands = asNumber(await contract.get_hands(season.seasonId, you));
    const top = await getTop(50);
    const mine = top.find((r) => r.isYou);
    return { volume, hands, rank: mine?.rank ?? (volume > 0n ? null : null) };
  }

  async function snapshot() {
    const season = await getSeason();
    const board = await getTop(50);
    const me = board.find((r) => r.isYou);
    const volume = me?.volume ?? asBigInt(await contract.get_volume(season.seasonId, you));
    const hands = me?.hands ?? asNumber(await contract.get_hands(season.seasonId, you));
    const rank = me?.rank ?? null;
    const reward: WarReward = rewardsForRank(rank, volume);
    return { season, board, you, volume, hands, rank, reward, shortYou: shortAddr(you) };
  }

  return {
    warAddress,
    you,
    shortAddr,
    getSeason,
    getTop,
    getMyStats,
    snapshot,
  };
}

export type WagerWarClient = ReturnType<typeof createWagerWarClient>;

const LOCAL_WAR_KEY = "shoe.wagerWar.local";

export type LocalWarState = {
  seasonId: number;
  startTs: number;
  endTs: number;
  volume: number;
  hands: number;
};

/** Off-chain demo tracker (localStorage) so Wager War UI works without chain. */
export function localWarTracker() {
  const deployment = getDeployment();
  const now = Math.floor(Date.now() / 1000);
  const start =
    typeof deployment.warStartTs === "number" && deployment.warStartTs > 0
      ? deployment.warStartTs
      : now;
  const end =
    typeof deployment.warEndTs === "number" && deployment.warEndTs > start
      ? deployment.warEndTs
      : start + 3600;

  function read(): LocalWarState {
    try {
      const raw = localStorage.getItem(LOCAL_WAR_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalWarState;
        if (parsed.startTs === start && parsed.endTs === end) return parsed;
      }
    } catch {
      /* ignore */
    }
    return { seasonId: 1, startTs: start, endTs: end, volume: 0, hands: 0 };
  }

  function write(s: LocalWarState) {
    localStorage.setItem(LOCAL_WAR_KEY, JSON.stringify(s));
  }

  function live(s: LocalWarState = read()) {
    const t = Math.floor(Date.now() / 1000);
    return t >= s.startTs && t < s.endTs;
  }

  function recordWager(amount: number, newHand: boolean) {
    const s = read();
    if (!live(s) || amount <= 0) return s;
    s.volume += amount;
    if (newHand) s.hands += 1;
    write(s);
    return s;
  }

  return { read, write, live, recordWager, start, end };
}
