// Best-effort brake on the (paid) AI features: a handful of calls per user per
// minute. In-memory, so it's per server instance — enough to stop a stuck button
// or a runaway loop, not a defence against abuse (only signed-in users reach it).
const recent = new Map<string, number[]>();

/** True when `key` already used up `limit` calls in the last minute; otherwise records this one. */
export function tooBusy(key: string, limit = 6): boolean {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((time) => now - time < 60_000);
  if (times.length >= limit) {
    recent.set(key, times);
    return true;
  }
  recent.set(key, [...times, now]);
  return false;
}
