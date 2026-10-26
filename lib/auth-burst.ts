/** Bounded per-process burst backstop; provider limits remain authoritative across instances. */
export class BurstGuard {
  private buckets = new Map<string, { count: number; expires: number }>();
  constructor(
    private maximum = 30,
    private windowMs = 15 * 60_000,
    private capacity = 4000,
  ) {}
  allow(key: string, now = Date.now()) {
    for (const [k, bucket] of this.buckets)
      if (bucket.expires <= now) this.buckets.delete(k);
    const bucket = this.buckets.get(key);
    if (bucket) {
      if (bucket.count >= this.maximum) return false;
      bucket.count++;
      return true;
    }
    if (this.buckets.size >= this.capacity) return false;
    this.buckets.set(key, { count: 1, expires: now + this.windowMs });
    return true;
  }
}
