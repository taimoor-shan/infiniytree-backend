import { computeReadingTime, escapeLike, stripHtml } from "../blog/text"

const words = (count: number) => Array(count).fill("leaf").join(" ")

describe("stripHtml", () => {
  it("turns markup into plain text", () => {
    expect(stripHtml("<h2>Water</h2><p>Dust&nbsp;the <strong>leaves</strong> &amp; stems.</p>")).toBe(
      "Water Dust the leaves & stems."
    )
  })
})

describe("computeReadingTime", () => {
  it("returns null for an empty body, so no reading time is shown", () => {
    expect(computeReadingTime(null)).toBeNull()
    expect(computeReadingTime(undefined)).toBeNull()
    expect(computeReadingTime("")).toBeNull()
    expect(computeReadingTime("<p> </p>")).toBeNull()
  })

  it("is never less than one minute", () => {
    expect(computeReadingTime(`<p>${words(10)}</p>`)).toBe(1)
  })

  it("rounds up at 200 words a minute", () => {
    expect(computeReadingTime(`<p>${words(200)}</p>`)).toBe(1)
    expect(computeReadingTime(`<p>${words(201)}</p>`)).toBe(2)
    expect(computeReadingTime(`<p>${words(1000)}</p>`)).toBe(5)
  })

  it("does not count tag names or attributes as words", () => {
    const html = `<p class="a very long class list">${words(5)}</p>`

    expect(computeReadingTime(html)).toBe(1)
    expect(stripHtml(html)).toBe(words(5))
  })
})

describe("escapeLike", () => {
  it("makes wildcards literal", () => {
    expect(escapeLike("100%_sure")).toBe("100\\%\\_sure")
    expect(escapeLike("a\\b")).toBe("a\\\\b")
  })

  it("leaves ordinary text alone", () => {
    expect(escapeLike("olive tree")).toBe("olive tree")
  })
})
