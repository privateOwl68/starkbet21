/** XP / badge rewards derived from frozen Wager War ranks (no on-chain token). */

export type WarBadge = "WarChampion" | "WarPodium" | "WarTop10" | "WarVeteran";

export type WarReward = {
  rank: number | null;
  xp: number;
  badges: WarBadge[];
  label: string;
};

export function rewardsForRank(rank: number | null, volume: bigint): WarReward {
  if (volume <= 0n || rank == null || rank < 1) {
    return { rank: null, xp: 0, badges: [], label: "No volume this war" };
  }
  if (rank === 1) {
    return {
      rank,
      xp: 1000,
      badges: ["WarChampion", "WarVeteran"],
      label: "War Champion",
    };
  }
  if (rank === 2) {
    return { rank, xp: 500, badges: ["WarPodium", "WarVeteran"], label: "Silver podium" };
  }
  if (rank === 3) {
    return { rank, xp: 350, badges: ["WarPodium", "WarVeteran"], label: "Bronze podium" };
  }
  if (rank <= 10) {
    return { rank, xp: 150, badges: ["WarTop10", "WarVeteran"], label: "Top 10" };
  }
  return { rank, xp: 25, badges: ["WarVeteran"], label: "War veteran" };
}

export function badgeLabel(b: WarBadge): string {
  switch (b) {
    case "WarChampion":
      return "Champion";
    case "WarPodium":
      return "Podium";
    case "WarTop10":
      return "Top 10";
    case "WarVeteran":
      return "Veteran";
  }
}
