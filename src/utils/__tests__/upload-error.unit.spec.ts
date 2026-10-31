import {
  MAX_UPLOAD_BYTES,
  describeFileTooLarge,
  describeUploadFailure,
  exceedsUploadLimit,
} from "../../admin/lib/upload-error"

const MB = 1024 * 1024

/** What the SDK throws for a refused request: the message, then the HTTP status. */
const refused = (status: number, message = "") =>
  Object.assign(new Error(message), { status })

describe("exceedsUploadLimit", () => {
  it("lets through a file under the shop's 20 MB and turns back one over it", () => {
    expect(MAX_UPLOAD_BYTES).toBe(20 * MB)
    expect(exceedsUploadLimit(10 * MB)).toBe(false)
    expect(exceedsUploadLimit(19 * MB)).toBe(false)
    expect(exceedsUploadLimit(20 * MB + 1)).toBe(true)
    expect(exceedsUploadLimit(25 * MB)).toBe(true)
  })

  it("counts the request around the file: one a few bytes under 20 MB is already too big for the server", () => {
    expect(exceedsUploadLimit(20 * MB - 100)).toBe(true)
    expect(exceedsUploadLimit(20 * MB - 100 * 1024)).toBe(false)
  })
})

describe("describeFileTooLarge", () => {
  it("names the kind of file, the limit and the size", () => {
    expect(describeFileTooLarge("video", 22.34 * MB)).toEqual({
      title: "Video must be 20 MB or smaller (22.3 MB).",
    })
    expect(describeFileTooLarge("image", 31 * MB)).toEqual({
      title: "Image must be 20 MB or smaller (31.0 MB).",
    })
  })
})

describe("describeUploadFailure", () => {
  it("a 413 for a file the shop itself accepts is the web server's, and says where to raise it", () => {
    // An Nginx page is not JSON, so the SDK's message is empty (HTTP/2) or the
    // bare reason phrase (HTTP/1.1).
    for (const error of [refused(413), refused(413, "Request Entity Too Large")]) {
      const failure = describeUploadFailure(error, { size: 12 * MB }, "video")

      expect(failure.title).toBe("The server refused this video (12.0 MB)")
      expect(failure.description).toContain("up to 20 MB")
      expect(failure.description).toContain("client_max_body_size")
      expect(failure.description).toContain("DEPLOYMENT.md")
    }
  })

  it("a 413 for a file over the shop's limit is about that limit, not about the web server", () => {
    const failure = describeUploadFailure(
      refused(413, "Upload exceeds 20 MB limit (received 25165824 bytes)"),
      { size: 24 * MB },
      "image"
    )

    expect(failure).toEqual(describeFileTooLarge("image", 24 * MB))
  })

  it("a request that never got an answer says so, and for a big file points at the same limit", () => {
    const failure = describeUploadFailure(
      new TypeError("Failed to fetch"),
      { size: 8 * MB },
      "video"
    )

    expect(failure.title).toBe("The video did not reach the server")
    expect(failure.description).toContain("probably too low")
    expect(failure.description).toContain("client_max_body_size")
  })

  it("a small file that never got an answer is only a matter of the connection", () => {
    const failure = describeUploadFailure(
      new TypeError("Failed to fetch"),
      { size: 300 * 1024 },
      "image"
    )

    expect(failure.title).toBe("The image did not reach the server")
    expect(failure.description).toBe("Check the connection and try again.")
  })

  it("keeps the server's own words for any other refusal", () => {
    expect(
      describeUploadFailure(refused(401, "Unauthorized"), { size: MB }, "image")
    ).toEqual({ title: "Unauthorized" })
    expect(
      describeUploadFailure(
        refused(500, "Invalid mime type: text/plain"),
        { size: MB },
        "image"
      )
    ).toEqual({ title: "Invalid mime type: text/plain" })
  })

  it("falls back to a plain sentence when there is nothing to quote", () => {
    expect(describeUploadFailure(refused(500), { size: MB }, "video")).toEqual({
      title: "Failed to upload video",
    })
    expect(describeUploadFailure(undefined, { size: MB }, "image")).toEqual({
      title: "Failed to upload image",
    })
    expect(describeUploadFailure("boom", { size: MB }, "image")).toEqual({
      title: "Failed to upload image",
    })
  })
})
