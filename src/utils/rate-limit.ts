/**
 * A small in-memory limiter for public store routes that answer a question a
 * stranger should not be able to ask at scale, such as "does this email have
 * an account?". The backend runs as one process, so memory is enough; a
 * restart forgets the counts, which only ever lets a visitor in.
 */
export const createRateLimiter = ({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number
  windowMs: number
  now?: () => number
}) => {
  const hits = new Map<string, number[]>()

  /** True when the visitor may go ahead; counts the request if so. */
  return (key: string): boolean => {
    const at = now()
    const recent = (hits.get(key) ?? []).filter((t) => at - t < windowMs)

    if (recent.length >= limit) {
      hits.set(key, recent)
      return false
    }

    recent.push(at)
    hits.set(key, recent)

    // Forget visitors whose window has passed, so the map can't grow forever
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (!times.some((t) => at - t < windowMs)) hits.delete(k)
      }
    }
    return true
  }
}

type Headers = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim() || undefined

/**
 * Who is asking. Behind Cloudflare and Nginx every request reaches Medusa from
 * 127.0.0.1, so the address is read from the headers: Cloudflare's own first
 * (it replaces whatever a visitor sends), then the first forwarded address,
 * which the storefront sets when it asks on a visitor's behalf.
 */
export const visitorKey = (headers: Headers, ip: string | undefined): string =>
  first(headers["cf-connecting-ip"]) ??
  first(headers["x-forwarded-for"]) ??
  ip ??
  "unknown"
