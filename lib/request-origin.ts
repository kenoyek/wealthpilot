/** Browser Origin is compared with the external Host, not a reverse proxy's internal URL. */
export function sameOriginPost(origin: string | null, host: string | null) {
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.host !== host.toLowerCase())
      return false;
    return (
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(parsed.host))
    );
  } catch {
    return false;
  }
}
