export function clamp01(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function daysSince(nowMs: number, thenMs?: number | null): number | null {
  if (!thenMs) return null;
  const deltaMs = nowMs - thenMs;
  if (deltaMs < 0) return 0;
  return deltaMs / (1000 * 60 * 60 * 24);
}

export function bandScore(days: number, bands: { freshDays: number; recentDays: number; agingDays: number; staleDays: number }): number {
  if (days < bands.freshDays) return 1.0;
  if (days < bands.recentDays) return 0.8;
  if (days < bands.agingDays) return 0.6;
  if (days < bands.staleDays) return 0.3;
  return 0.0;
}

export function saturatingLengthScore(text: string, targetChars: number): number {
  const t = (text ?? "").trim();
  if (!t) return 0;
  return clamp01(t.length / targetChars);
}

export function containsBlacklist(text: string, blacklist: string[]): boolean {
  const t = (text ?? "").toLowerCase();
  return blacklist.some(p => t.includes(p.toLowerCase()));
}

export function scoreBand(score100: number, thresholds: { excellent: number; good: number; fair: number; poor: number }): "excellent"|"good"|"fair"|"poor"|"critical" {
  if (score100 >= thresholds.excellent) return "excellent";
  if (score100 >= thresholds.good) return "good";
  if (score100 >= thresholds.fair) return "fair";
  if (score100 >= thresholds.poor) return "poor";
  return "critical";
}

export function weightedAverage01(items: { score01: number; weight: number }[]): number {
  const denom = items.reduce((s, i) => s + i.weight, 0);
  if (denom <= 0) return 0;
  const num = items.reduce((s, i) => s + i.score01 * i.weight, 0);
  return clamp01(num / denom);
}







