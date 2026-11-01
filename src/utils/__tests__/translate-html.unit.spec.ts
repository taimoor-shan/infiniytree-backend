import { MAX_REQUEST_CHARS } from "../translations/plan"
import { translateHtml } from "../translations/translate-html"

const upper = async (fields: { key: string; text: string }[]) =>
  Object.fromEntries(fields.map((f) => [f.key, f.text.toUpperCase()]))

describe("translateHtml", () => {
  it("sends a short text in one request and returns its translation", async () => {
    const translate = jest.fn(upper)

    await expect(translateHtml("<p>Hello <b>you</b></p>", translate)).resolves.toBe(
      "<P>HELLO <B>YOU</B></P>"
    )
    expect(translate).toHaveBeenCalledTimes(1)
  })

  it("cuts a long text into pieces and puts them back in order", async () => {
    const html = Array.from(
      { length: 400 },
      (_, i) => `<p>Paragraph number ${i} of the long description.</p>`
    ).join("")
    expect(html.length).toBeGreaterThan(MAX_REQUEST_CHARS * 2)

    const translate = jest.fn(upper)
    const translated = await translateHtml(html, translate)

    expect(translate.mock.calls.length).toBeGreaterThan(1)
    for (const [fields] of translate.mock.calls) {
      expect(fields.reduce((sum, f) => sum + f.text.length, 0)).toBeLessThanOrEqual(
        MAX_REQUEST_CHARS
      )
    }
    expect(translated).toBe(html.toUpperCase())
  })

  it("fails instead of returning a text with a hole in it", async () => {
    const html = Array.from(
      { length: 400 },
      (_, i) => `<p>Paragraph number ${i} of the long description.</p>`
    ).join("")

    // The provider answers every request but the last one
    let calls = 0
    const forgetful = async (fields: { key: string; text: string }[]) => {
      calls += 1
      return calls === 3 ? {} : upper(fields)
    }

    await expect(translateHtml(html, forgetful)).rejects.toThrow(
      /did not return the whole text/
    )
  })

  it("fails when the provider returns nothing for the text", async () => {
    await expect(translateHtml("<p>Hello</p>", async () => ({}))).rejects.toThrow(
      /did not return the whole text/
    )
    await expect(
      translateHtml("<p>Hello</p>", async (fields) =>
        Object.fromEntries(fields.map((f) => [f.key, "  "]))
      )
    ).rejects.toThrow(/did not return the whole text/)
  })

  it("passes a provider's own error on", async () => {
    await expect(
      translateHtml("<p>Hello</p>", async () => {
        throw new Error("Gemini quota exceeded")
      })
    ).rejects.toThrow("Gemini quota exceeded")
  })
})
