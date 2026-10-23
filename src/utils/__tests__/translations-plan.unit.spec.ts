import { chunkHtml, splitHtmlBlocks } from "../translations/chunk-html"
import { planTranslation } from "../translations/plan"

describe("splitHtmlBlocks", () => {
  it("splits at top-level blocks and loses nothing", () => {
    const html =
      "<h2>Water</h2><p>Dust the <strong>leaves</strong>.</p><ul><li>One</li><li><p>Two</p></li></ul><hr><p>End</p>"

    expect(splitHtmlBlocks(html)).toEqual([
      "<h2>Water</h2>",
      "<p>Dust the <strong>leaves</strong>.</p>",
      "<ul><li>One</li><li><p>Two</p></li></ul>",
      "<hr>",
      "<p>End</p>",
    ])
    expect(splitHtmlBlocks(html).join("")).toBe(html)
  })

  it("keeps a table, with its nested cells, as one block", () => {
    const table = "<table><tbody><tr><td><p>A</p></td><td>B</td></tr></tbody></table>"

    expect(splitHtmlBlocks(`<p>x</p>${table}<p>y</p>`)).toEqual([
      "<p>x</p>",
      table,
      "<p>y</p>",
    ])
  })

  it("keeps trailing text and tag-free bodies", () => {
    expect(splitHtmlBlocks("<p>a</p>tail")).toEqual(["<p>a</p>", "tail"])
    expect(splitHtmlBlocks("plain text")).toEqual(["plain text"])
    expect(splitHtmlBlocks("")).toEqual([])
  })

  it("treats a self-closing tag and void tags as complete blocks", () => {
    expect(splitHtmlBlocks('<p>a</p><img src="x.png"/><br><p>b</p>')).toEqual([
      "<p>a</p>",
      '<img src="x.png"/>',
      "<br>",
      "<p>b</p>",
    ])
  })
})

describe("chunkHtml", () => {
  const paragraphs = Array.from({ length: 10 }, (_, i) => `<p>${"word ".repeat(20)}${i}</p>`)
  const html = paragraphs.join("")

  it("returns a short body whole", () => {
    expect(chunkHtml("<p>short</p>", 1000)).toEqual(["<p>short</p>"])
  })

  it("cuts a long body only between blocks and joins back to the original", () => {
    const chunks = chunkHtml(html, 300)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join("")).toBe(html)

    for (const chunk of chunks) {
      // every chunk is a run of whole paragraphs
      expect(chunk.startsWith("<p>")).toBe(true)
      expect(chunk.endsWith("</p>")).toBe(true)
      expect(chunk.length).toBeLessThanOrEqual(300)
    }
  })

  it("leaves one oversized block whole rather than cutting it", () => {
    const big = `<p>${"x".repeat(500)}</p>`
    const chunks = chunkHtml(`${big}<p>a</p>`, 100)

    expect(chunks[0]).toBe(big)
    expect(chunks.join("")).toBe(`${big}<p>a</p>`)
  })
})

describe("planTranslation", () => {
  it("sends short fields together in one request", () => {
    const plan = planTranslation(
      [
        { key: "title", text: "Hello" },
        { key: "excerpt", text: "World" },
      ],
      1000
    )

    expect(plan.requests).toEqual([
      [
        { key: "title", text: "Hello" },
        { key: "excerpt", text: "World" },
      ],
    ])
    expect(plan.reassemble({ title: "Hallo", excerpt: "Welt" })).toEqual({
      title: "Hallo",
      excerpt: "Welt",
    })
  })

  it("splits a long HTML field into pieces and puts the answer back in order", () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `<p>${"a".repeat(80)}${i}</p>`)
    const content = paragraphs.join("")

    const plan = planTranslation(
      [
        { key: "title", text: "Title" },
        { key: "content", text: content, html: true },
      ],
      250
    )

    // The pieces are sent as separate fields, never above the limit.
    const sent = plan.requests.flat()
    expect(sent.filter((field) => field.key.startsWith("content#")).length).toBeGreaterThan(1)
    for (const request of plan.requests) {
      const size = request.reduce((total, field) => total + field.text.length, 0)
      expect(size).toBeLessThanOrEqual(250)
    }

    // A provider that answers every sent key: the pieces rejoin as the original.
    const answered = Object.fromEntries(sent.map((field) => [field.key, field.text]))
    const result = plan.reassemble(answered)

    expect(result.content).toBe(content)
    expect(result.title).toBe("Title")
  })

  it("does not split a long field that is not HTML", () => {
    const plan = planTranslation([{ key: "excerpt", text: "x".repeat(500) }], 100)

    expect(plan.requests.flat().map((field) => field.key)).toEqual(["excerpt"])
  })

  it("skips a field whose pieces did not all come back", () => {
    const content = Array.from({ length: 4 }, (_, i) => `<p>${"b".repeat(80)}${i}</p>`).join("")
    const plan = planTranslation([{ key: "content", text: content, html: true }], 200)
    const keys = plan.requests.flat().map((field) => field.key)

    // Answer all but the last piece.
    const partial = Object.fromEntries(keys.slice(0, -1).map((key) => [key, "x"]))

    expect(plan.reassemble(partial)).toEqual({})
  })

  it("plans nothing for no fields", () => {
    const plan = planTranslation([])

    expect(plan.requests).toEqual([])
    expect(plan.reassemble({})).toEqual({})
  })
})
