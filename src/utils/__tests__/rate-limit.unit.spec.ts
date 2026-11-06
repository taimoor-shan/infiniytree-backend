import { createRateLimiter, visitorKey } from "../rate-limit"

describe("createRateLimiter", () => {
  const minutes = (n: number) => n * 60 * 1000

  it("allows the limit within the window and refuses the next one", () => {
    let now = 0
    const allow = createRateLimiter({ limit: 3, windowMs: minutes(10), now: () => now })

    expect([allow("a"), allow("a"), allow("a"), allow("a")]).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it("allows again once the earliest request has left the window", () => {
    let now = 0
    const allow = createRateLimiter({ limit: 2, windowMs: minutes(10), now: () => now })
    allow("a")
    now = minutes(5)
    allow("a")

    now = minutes(9)
    expect(allow("a")).toBe(false)
    now = minutes(10) + 1
    expect(allow("a")).toBe(true)
    expect(allow("a")).toBe(false)
  })

  it("counts every visitor apart", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: minutes(10), now: () => 0 })

    expect(allow("a")).toBe(true)
    expect(allow("b")).toBe(true)
    expect(allow("a")).toBe(false)
  })
})

describe("visitorKey", () => {
  it("prefers Cloudflare's visitor address, which a visitor cannot set", () => {
    expect(
      visitorKey(
        { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
        "127.0.0.1"
      )
    ).toBe("203.0.113.7")
  })

  it("falls back to the first forwarded address, then the connection's", () => {
    expect(visitorKey({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }, "127.0.0.1")).toBe(
      "198.51.100.1"
    )
    expect(visitorKey({}, "127.0.0.1")).toBe("127.0.0.1")
    expect(visitorKey({}, undefined)).toBe("unknown")
  })
})
