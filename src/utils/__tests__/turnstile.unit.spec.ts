import { verifyTurnstile } from "../turnstile"

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type Call = { url: string; body: URLSearchParams }

/** A fetch that records what it was asked and answers with `reply`. */
function fakeFetch(reply: () => Promise<unknown>) {
  const calls: Call[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body as URLSearchParams })
    return reply()
  }) as unknown as typeof fetch

  return { fetchImpl, calls }
}

/** Cloudflare answering with a JSON body. */
const cloudflareSays = (body: unknown) => async () => ({
  json: async () => body,
})

describe("verifyTurnstile", () => {
  it("is skipped without a secret and never calls Cloudflare", async () => {
    const { fetchImpl, calls } = fakeFetch(cloudflareSays({ success: true }))

    expect(
      await verifyTurnstile("token", { secret: undefined, fetchImpl })
    ).toEqual({ status: "skipped" })
    expect(await verifyTurnstile("token", { secret: "", fetchImpl })).toEqual({
      status: "skipped",
    })
    expect(calls).toHaveLength(0)
  })

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
    ["a number", 42],
    ["a token over 2,048 characters", "x".repeat(2049)],
  ])("rejects %s without calling Cloudflare", async (_label, token) => {
    const { fetchImpl, calls } = fakeFetch(cloudflareSays({ success: true }))

    expect(await verifyTurnstile(token, { secret: "s", fetchImpl })).toEqual({
      status: "rejected",
      codes: ["missing-input-response"],
    })
    expect(calls).toHaveLength(0)
  })

  it("passes a token Cloudflare accepts and sends the secret, token and visitor IP", async () => {
    const { fetchImpl, calls } = fakeFetch(cloudflareSays({ success: true }))

    const outcome = await verifyTurnstile("the-token", {
      secret: "the-secret",
      ip: "203.0.113.7",
      fetchImpl,
    })

    expect(outcome).toEqual({ status: "passed" })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(SITEVERIFY_URL)
    expect(calls[0].body.get("secret")).toBe("the-secret")
    expect(calls[0].body.get("response")).toBe("the-token")
    expect(calls[0].body.get("remoteip")).toBe("203.0.113.7")
  })

  it("leaves out remoteip when there is no visitor IP", async () => {
    const { fetchImpl, calls } = fakeFetch(cloudflareSays({ success: true }))

    await verifyTurnstile("t", { secret: "s", ip: null, fetchImpl })

    expect(calls[0].body.has("remoteip")).toBe(false)
  })

  it.each([
    ["invalid-input-response"],
    ["timeout-or-duplicate"],
    ["missing-input-response"],
    ["some-code-nobody-listed"],
  ])("rejects a token Cloudflare refuses with %s", async (code) => {
    const { fetchImpl } = fakeFetch(
      cloudflareSays({ success: false, "error-codes": [code] })
    )

    expect(await verifyTurnstile("t", { secret: "s", fetchImpl })).toEqual({
      status: "rejected",
      codes: [code],
    })
  })

  it("rejects a refusal that names no code", async () => {
    const { fetchImpl } = fakeFetch(cloudflareSays({ success: false }))

    expect(await verifyTurnstile("t", { secret: "s", fetchImpl })).toEqual({
      status: "rejected",
      codes: [],
    })
  })

  it.each([
    ["missing-input-secret"],
    ["invalid-input-secret"],
    ["bad-request"],
    ["internal-error"],
  ])(
    "treats %s as unavailable: our configuration or Cloudflare is at fault, not the visitor",
    async (code) => {
      const { fetchImpl } = fakeFetch(
        cloudflareSays({ success: false, "error-codes": [code] })
      )

      const outcome = await verifyTurnstile("t", { secret: "s", fetchImpl })

      expect(outcome.status).toBe("unavailable")
    }
  )

  it("treats a network error as unavailable", async () => {
    const { fetchImpl } = fakeFetch(async () => {
      throw new Error("getaddrinfo ENOTFOUND challenges.cloudflare.com")
    })

    expect(await verifyTurnstile("t", { secret: "s", fetchImpl })).toEqual({
      status: "unavailable",
      reason: "getaddrinfo ENOTFOUND challenges.cloudflare.com",
    })
  })

  it("treats a reply that is not JSON as unavailable", async () => {
    const { fetchImpl } = fakeFetch(async () => ({
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON at position 0")
      },
    }))

    expect((await verifyTurnstile("t", { secret: "s", fetchImpl })).status).toBe(
      "unavailable"
    )
  })

  it.each([
    ["an empty object", {}],
    ["null", null],
    ["a success that is not a boolean", { success: "yes" }],
  ])("treats %s as unavailable", async (_label, body) => {
    const { fetchImpl } = fakeFetch(cloudflareSays(body))

    expect((await verifyTurnstile("t", { secret: "s", fetchImpl })).status).toBe(
      "unavailable"
    )
  })

  it("treats a request that hangs as unavailable once the timeout passes", async () => {
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("The operation was aborted"))
        )
      })) as unknown as typeof fetch

    const outcome = await verifyTurnstile("t", {
      secret: "s",
      timeoutMs: 20,
      fetchImpl: hangingFetch,
    })

    expect(outcome.status).toBe("unavailable")
  })
})
