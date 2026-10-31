import {
  POSTER_KEY,
  VIDEO_KEY,
  checkPosterUrl,
  checkVideoUrl,
  normalizeProductVideo,
  readProductVideo,
  sameProductVideo,
  videoMetadata,
} from "../../admin/lib/product-video"

describe("readProductVideo", () => {
  it("reads the two keys the storefront gallery reads", () => {
    expect([VIDEO_KEY, POSTER_KEY]).toEqual(["video_url", "video_poster"])
    expect(
      readProductVideo({
        video_url: "https://media.example.com/a.mp4",
        video_poster: "https://media.example.com/a.jpg",
      })
    ).toEqual({
      video: "https://media.example.com/a.mp4",
      poster: "https://media.example.com/a.jpg",
    })
  })

  it("is empty for a product without them, whatever else its metadata holds", () => {
    expect(readProductVideo(undefined)).toEqual({ video: "", poster: "" })
    expect(readProductVideo(null)).toEqual({ video: "", poster: "" })
    expect(readProductVideo({ seo_title: "Blue Cascade" })).toEqual({
      video: "",
      poster: "",
    })
  })

  it("trims, and ignores what is not text", () => {
    expect(
      readProductVideo({ video_url: "  /static/a.mp4 ", video_poster: 42 })
    ).toEqual({ video: "/static/a.mp4", poster: "" })
  })
})

describe("videoMetadata", () => {
  it("sends only the two keys, so the rest of the metadata is left alone", () => {
    expect(
      videoMetadata({ video: "https://media.example.com/a.mp4", poster: "" })
    ).toEqual({
      video_url: "https://media.example.com/a.mp4",
      video_poster: "",
    })
  })

  // Medusa merges metadata and deletes a key whose value is "".
  it("sends empty text to take a video away, and its still image with it", () => {
    expect(
      videoMetadata({ video: "  ", poster: "https://media.example.com/a.jpg" })
    ).toEqual({ video_url: "", video_poster: "" })
  })

  it("trims what it sends", () => {
    expect(
      videoMetadata({ video: " /static/a.mp4 ", poster: " /static/a.jpg\n" })
    ).toEqual({ video_url: "/static/a.mp4", video_poster: "/static/a.jpg" })
  })
})

describe("sameProductVideo", () => {
  it("compares what would be saved, not what was typed", () => {
    expect(
      sameProductVideo(
        { video: " /static/a.mp4", poster: "" },
        { video: "/static/a.mp4", poster: "" }
      )
    ).toBe(true)
    expect(
      sameProductVideo(
        { video: "/static/a.mp4", poster: "/static/a.jpg" },
        { video: "/static/a.mp4", poster: "" }
      )
    ).toBe(false)
  })

  it("does not count a still image that has no video", () => {
    expect(
      sameProductVideo(
        { video: "", poster: "/static/a.jpg" },
        { video: "", poster: "" }
      )
    ).toBe(true)
    expect(normalizeProductVideo({ video: "", poster: "/static/a.jpg" })).toEqual(
      { video: "", poster: "" }
    )
  })
})

describe("checkVideoUrl", () => {
  it("accepts nothing (no video), a web address and an uploaded file", () => {
    expect(checkVideoUrl("")).toBeNull()
    expect(checkVideoUrl("   ")).toBeNull()
    expect(checkVideoUrl("https://media.example.com/a.mp4")).toBeNull()
    expect(checkVideoUrl("http://localhost:9000/static/1730-a.webm")).toBeNull()
    expect(checkVideoUrl("/static/1730-a.mp4")).toBeNull()
  })

  it("refuses what the storefront would drop", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:video/mp4;base64,AAAA",
      "//evil.example.com/a.mp4",
      "ftp://example.com/a.mp4",
      "a.mp4",
    ]) {
      expect(checkVideoUrl(url)).toMatch(/uploaded here or an address/)
    }
  })

  it("says why a YouTube or Vimeo page cannot be used", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=abc123",
      "https://youtu.be/abc123",
      "https://www.youtube-nocookie.com/embed/abc123",
      "https://vimeo.com/123456",
      "https://player.vimeo.com/video/123456",
    ]) {
      expect(checkVideoUrl(url)).toMatch(/YouTube and Vimeo/)
    }
  })

  it("does not mistake another host for them", () => {
    expect(checkVideoUrl("https://notyoutube.com/a.mp4")).toBeNull()
    expect(checkVideoUrl("https://media.example.com/vimeo.com/a.mp4")).toBeNull()
  })
})

describe("checkPosterUrl", () => {
  it("accepts nothing, a web address and an uploaded file", () => {
    expect(checkPosterUrl("")).toBeNull()
    expect(checkPosterUrl("https://media.example.com/a.jpg")).toBeNull()
    expect(checkPosterUrl("/static/1730-a.jpg")).toBeNull()
  })

  it("refuses what the storefront would drop", () => {
    expect(checkPosterUrl("javascript:alert(1)")).toMatch(/uploaded here or an address/)
    expect(checkPosterUrl("//evil.example.com/a.jpg")).toMatch(/uploaded here or an address/)
  })
})
