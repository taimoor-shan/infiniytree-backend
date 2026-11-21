import {
  DEFAULT_MOBILE_HEIGHT,
  HOME_BANNER_KEYS,
  MAX_HEIGHT,
  MIN_HEIGHT,
  checkHeight,
  checkPosterUrl,
  checkVideoUrl,
  normalizeHomeBanner,
  readHomeBanner,
  sameHomeBanner,
  withHomeBanner,
  type HomeBannerForm,
} from "../../admin/lib/home-banner"

const EMPTY: HomeBannerForm = {
  video: "",
  poster: "",
  heightDesktop: "",
  heightMobile: "",
  hidden: false,
}

describe("the keys", () => {
  it("are the ones the storefront reads from the store's metadata", () => {
    expect(HOME_BANNER_KEYS).toEqual({
      video: "home_banner_video",
      poster: "home_banner_poster",
      heightDesktop: "home_banner_height_desktop",
      heightMobile: "home_banner_height_mobile",
      hidden: "home_banner_hidden",
    })
  })

  it("keep the height range and default of the storefront", () => {
    expect([MIN_HEIGHT, MAX_HEIGHT, DEFAULT_MOBILE_HEIGHT]).toEqual([
      120, 1600, 420,
    ])
  })
})

describe("readHomeBanner", () => {
  it("reads every setting of the box", () => {
    expect(
      readHomeBanner({
        home_banner_video: "https://media.example.com/a.mp4",
        home_banner_poster: "https://media.example.com/a.jpg",
        home_banner_height_desktop: "640",
        home_banner_height_mobile: "380",
        home_banner_hidden: "true",
      })
    ).toEqual({
      video: "https://media.example.com/a.mp4",
      poster: "https://media.example.com/a.jpg",
      heightDesktop: "640",
      heightMobile: "380",
      hidden: true,
    })
  })

  it("is empty for a store without them, whatever else its metadata holds", () => {
    expect(readHomeBanner(undefined)).toEqual(EMPTY)
    expect(readHomeBanner(null)).toEqual(EMPTY)
    expect(readHomeBanner({ seo_title: "InfinYtree" })).toEqual(EMPTY)
  })

  it("trims, shows a stored number as text, and ignores what is not text", () => {
    expect(
      readHomeBanner({
        home_banner_video: "  /static/a.mp4 ",
        home_banner_poster: 42,
        home_banner_height_desktop: 640,
        home_banner_height_mobile: {},
      })
    ).toEqual({
      video: "/static/a.mp4",
      poster: "",
      heightDesktop: "640",
      heightMobile: "",
      hidden: false,
    })
  })

  it("is visible unless hidden is switched on", () => {
    for (const hidden of ["", "false", "0", false, null, undefined]) {
      expect(readHomeBanner({ home_banner_hidden: hidden }).hidden).toBe(false)
    }
    for (const hidden of ["true", "TRUE", "1", "yes", true]) {
      expect(readHomeBanner({ home_banner_hidden: hidden }).hidden).toBe(true)
    }
  })
})

describe("normalizeHomeBanner and sameHomeBanner", () => {
  it("takes the still image away with the video, and keeps the settings", () => {
    expect(
      normalizeHomeBanner({
        video: "  ",
        poster: "https://media.example.com/a.jpg",
        heightDesktop: " 700 ",
        heightMobile: "",
        hidden: true,
      })
    ).toEqual({
      video: "",
      poster: "",
      heightDesktop: "700",
      heightMobile: "",
      hidden: true,
    })
  })

  it("compares forms the way they are saved", () => {
    const saved = { ...EMPTY, video: "https://media.example.com/a.mp4" }
    expect(sameHomeBanner({ ...saved, video: " " + saved.video + " " }, saved)).toBe(true)
    expect(sameHomeBanner({ ...saved, heightDesktop: "640" }, saved)).toBe(false)
    expect(sameHomeBanner({ ...saved, hidden: true }, saved)).toBe(false)
    expect(sameHomeBanner({ ...saved, poster: "/static/a.jpg" }, saved)).toBe(false)
    // A still image with no video is not a difference: it is not saved either.
    expect(sameHomeBanner({ ...EMPTY, poster: "/static/a.jpg" }, EMPTY)).toBe(true)
  })
})

// A store's metadata is replaced by what is saved (the store module writes it
// with `upsertWithReplace`: no merge, and a key set to "" stays), unlike a
// product's. `integration-tests/http/home-banner.spec.ts` proves that against
// Medusa; these are the rules `withHomeBanner` follows because of it.
describe("withHomeBanner", () => {
  const OTHER = { seo_title: "InfinYtree", announcement: { en: "Free delivery" } }

  it("writes the banner's keys that have a value, and no others", () => {
    expect(
      withHomeBanner(undefined, {
        video: "https://media.example.com/a.mp4",
        poster: "https://media.example.com/a.jpg",
        heightDesktop: "640",
        heightMobile: "380",
        hidden: false,
      })
    ).toEqual({
      home_banner_video: "https://media.example.com/a.mp4",
      home_banner_poster: "https://media.example.com/a.jpg",
      home_banner_height_desktop: "640",
      home_banner_height_mobile: "380",
    })
  })

  it("sends back every other key of the metadata, or saving would wipe them", () => {
    expect(
      withHomeBanner(OTHER, { ...EMPTY, video: "/static/a.mp4" })
    ).toEqual({ ...OTHER, home_banner_video: "/static/a.mp4" })
  })

  it("leaves out what the box left empty, which removes it from the store", () => {
    const saved = withHomeBanner(
      {
        ...OTHER,
        home_banner_video: "/static/old.mp4",
        home_banner_poster: "/static/old.jpg",
        home_banner_height_desktop: "700",
        home_banner_height_mobile: "380",
        home_banner_hidden: "true",
      },
      EMPTY
    )
    expect(saved).toEqual(OTHER)
    // Not an empty text either: the store would keep a key set to "".
    for (const value of Object.values(saved)) {
      expect(value).not.toBe("")
    }
  })

  it("takes the still image away with the video, and keeps the heights", () => {
    expect(
      withHomeBanner(
        { home_banner_video: "/static/a.mp4", home_banner_poster: "/static/a.jpg" },
        { ...EMPTY, poster: "/static/a.jpg", heightMobile: "380" }
      )
    ).toEqual({ home_banner_height_mobile: "380" })
  })

  it("writes hidden as the text the storefront reads, and only while it is on", () => {
    const form = { ...EMPTY, video: "/static/a.mp4" }
    expect(withHomeBanner({}, { ...form, hidden: true })).toMatchObject({
      home_banner_hidden: "true",
    })
    expect(withHomeBanner({ home_banner_hidden: "true" }, form)).not.toHaveProperty(
      "home_banner_hidden"
    )
  })

  it("replaces an old value, and trims what was typed", () => {
    expect(
      withHomeBanner(
        { home_banner_video: "/static/old.mp4" },
        { ...EMPTY, video: "  /static/new.mp4 ", heightDesktop: " 700 " }
      )
    ).toEqual({
      home_banner_video: "/static/new.mp4",
      home_banner_height_desktop: "700",
    })
  })

  it("does not change the metadata it was given", () => {
    const metadata = { ...OTHER, home_banner_video: "/static/old.mp4" }
    const copy = JSON.parse(JSON.stringify(metadata))
    withHomeBanner(metadata, { ...EMPTY, video: "/static/new.mp4" })
    expect(metadata).toEqual(copy)
  })

  it("round-trips: what it saves is what readHomeBanner shows again", () => {
    const form: HomeBannerForm = {
      video: "/static/a.mp4",
      poster: "/static/a.jpg",
      heightDesktop: "700",
      heightMobile: "",
      hidden: true,
    }
    expect(readHomeBanner(withHomeBanner(OTHER, form))).toEqual(form)
    expect(readHomeBanner(withHomeBanner(OTHER, EMPTY))).toEqual(EMPTY)
  })
})

describe("checkVideoUrl", () => {
  it("accepts nothing yet, an upload path and a web address", () => {
    expect(checkVideoUrl("")).toBeNull()
    expect(checkVideoUrl("   ")).toBeNull()
    expect(checkVideoUrl("/static/1700000000000-banner.mp4")).toBeNull()
    expect(checkVideoUrl("https://media.example.com/banner.mp4")).toBeNull()
  })

  it("refuses what the storefront could not load", () => {
    for (const bad of ["banner.mp4", "javascript:alert(1)", "//evil.example.com/a.mp4", "ftp://x.example.com/a.mp4"]) {
      expect(checkVideoUrl(bad)).toMatch(/uploaded here or an address/)
    }
  })

  it("explains that YouTube and Vimeo pages are not files", () => {
    for (const page of [
      "https://www.youtube.com/watch?v=abc",
      "https://youtu.be/abc",
      "https://vimeo.com/12345",
    ]) {
      expect(checkVideoUrl(page)).toMatch(/YouTube and Vimeo/)
    }
  })
})

describe("checkPosterUrl", () => {
  it("accepts nothing, an upload path and a web address, and refuses the rest", () => {
    expect(checkPosterUrl("")).toBeNull()
    expect(checkPosterUrl("/static/a.jpg")).toBeNull()
    expect(checkPosterUrl("https://media.example.com/a.jpg")).toBeNull()
    expect(checkPosterUrl("a.jpg")).toMatch(/uploaded here or an address/)
  })
})

describe("checkHeight", () => {
  it("accepts empty (the default) and whole numbers in range", () => {
    for (const ok of ["", "  ", "120", "420", "640", "1600", " 700 "]) {
      expect(checkHeight(ok)).toBeNull()
    }
  })

  it("refuses what is not a whole number", () => {
    for (const bad of ["abc", "64.5", "1e-3", "NaN", "Infinity", "-"]) {
      expect(checkHeight(bad)).toMatch(/whole number/)
    }
  })

  it("refuses a height outside the range, naming the range", () => {
    for (const bad of ["0", "-50", "119", "1601", "99999"]) {
      expect(checkHeight(bad)).toMatch(/between 120 and 1600/)
    }
  })
})
