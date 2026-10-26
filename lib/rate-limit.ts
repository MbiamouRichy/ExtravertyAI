/**
 * In-memory sliding window, per server instance. Defense in depth against
 * bursts on costly reads (audience counts); authorization stays the real
 * boundary and every limit that matters is also enforced in the database.
 */
const windows = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (windows.get(key) ?? []).filter((time) => time > now - windowMs);
  if (recent.length >= limit) {
    windows.set(key, recent);
    return false;
  }
  recent.push(now);
  windows.set(key, recent);
  if (windows.size > MAX_KEYS) {
    for (const [other, times] of windows) {
      if (!times.some((time) => time > now - windowMs)) windows.delete(other);
      if (windows.size <= MAX_KEYS / 2) break;
    }
  }
  return true;
}
