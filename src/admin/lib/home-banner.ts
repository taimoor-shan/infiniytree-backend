/**
 * The video banner under the Best Sellers on the storefront's home page. It
 * lives in the store's metadata, where the storefront reads it
 * (`src/lib/util/home-banner.ts` there reads the same keys):
 *   home_banner_video           the video file, MP4 or WebM
 *   home_banner_poster          the still image shown while the video loads, and
 *                               instead of it for visitors who save data or ask
 *                               for less motion (optional)
 *   home_banner_height_desktop  height in px from 1024 px wide up; empty means
 *                               the video's own proportions (3:1)
 *   home_banner_height_mobile   height in px below 1024 px; empty means 420
 *   home_banner_hidden          "true" keeps the banner off and the rest saved
 */
export const HOME_BANNER_KEYS = {
  video: "home_banner_video",
  poster: "home_banner_poster",
  heightDesktop: "home_banner_height_desktop",
  heightMobile: "home_banner_height_mobile",
  hidden: "home_banner_hidden",
} as const

/** Keep in step with the storefront's `src/lib/util/home-banner.ts`. */
export const MIN_HEIGHT = 120
export const MAX_HEIGHT = 1600
export const DEFAULT_MOBILE_HEIGHT = 420

export type HomeBannerForm = {
  video: string
  poster: string
  /** What is typed in the box: a whole number of px, or empty for the default. */
  heightDesktop: string
  heightMobile: string
  hidden: boolean
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

/** A stored height as the text of the box: a number or its text, else empty. */
const heightText = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : text(value)

const isOn = (value: unknown) =>
  value === true ||
  (typeof value === "string" && /^(true|1|yes|on)$/i.test(value.trim()))

export const readHomeBanner = (
  metadata?: Record<string, unknown> | null
): HomeBannerForm => ({
  video: text(metadata?.[HOME_BANNER_KEYS.video]),
  poster: text(metadata?.[HOME_BANNER_KEYS.poster]),
  heightDesktop: heightText(metadata?.[HOME_BANNER_KEYS.heightDesktop]),
  heightMobile: heightText(metadata?.[HOME_BANNER_KEYS.heightMobile]),
  hidden: isOn(metadata?.[HOME_BANNER_KEYS.hidden]),
})

/**
 * A still image belongs to its video, so taking the video away takes the still
 * image with it. The heights and the switch stay: they are settings for the next
 * video. The form is compared and saved in this shape.
 */
export const normalizeHomeBanner = (form: HomeBannerForm): HomeBannerForm => {
  const video = form.video.trim()
  return {
    video,
    poster: video ? form.poster.trim() : "",
    heightDesktop: form.heightDesktop.trim(),
    heightMobile: form.heightMobile.trim(),
    hidden: form.hidden,
  }
}

export const sameHomeBanner = (a: HomeBannerForm, b: HomeBannerForm) => {
  const [x, y] = [normalizeHomeBanner(a), normalizeHomeBanner(b)]
  return (
    x.video === y.video &&
    x.poster === y.poster &&
    x.heightDesktop === y.heightDesktop &&
    x.heightMobile === y.heightMobile &&
    x.hidden === y.hidden
  )
}

/**
 * What the storefront can load: a web address, or a path on its own origin
 * (`/static/…`, where uploads are served). The same rule as in `product-video.ts`
 * and the storefront's `home-banner.ts`, which drops anything else.
 */
const LOADABLE = /^(https?:\/\/\S|\/(?!\/)\S)/i

/** Pages that play a video in their own player rather than being a file. */
const VIDEO_PAGES =
  /^https?:\/\/(?:[\w-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com)(?:[/:?#]|$)/i

/** What is wrong with the video's address, in words for the editor. */
export const checkVideoUrl = (value: string): string | null => {
  const url = value.trim()
  if (!url) return null
  if (!LOADABLE.test(url)) {
    return "The video must be a file uploaded here or an address starting with https://."
  }
  if (VIDEO_PAGES.test(url)) {
    return "YouTube and Vimeo pages cannot play in the banner. Upload the video file (MP4 or WebM), or link to the file itself."
  }
  return null
}

/** What is wrong with the still image's address, in words for the editor. */
export const checkPosterUrl = (value: string): string | null => {
  const url = value.trim()
  if (!url) return null
  return LOADABLE.test(url)
    ? null
    : "The still image must be a file uploaded here or an address starting with https://."
}

/** What is wrong with a height, in words for the editor. Empty is fine: it means the default. */
export const checkHeight = (value: string): string | null => {
  const height = value.trim()
  if (!height) return null

  const number = Number(height)
  if (!Number.isInteger(number)) {
    return "Enter a whole number of pixels, or leave it empty."
  }
  if (number < MIN_HEIGHT || number > MAX_HEIGHT) {
    return `Use a height between ${MIN_HEIGHT} and ${MAX_HEIGHT} px, or leave it empty.`
  }
  return null
}

const BANNER_KEY_NAMES: string[] = Object.values(HOME_BANNER_KEYS)

/**
 * The store's metadata to save, with the banner's settings taken from the form.
 *
 * A store's metadata is **replaced** by what is saved, not merged into the old
 * one the way a product's is: the store module writes the object it is given as
 * it is (`upsertWithReplace`) and does not drop a key whose value is `""`. So
 * every other key travels along with the banner's, or saving the banner would
 * wipe them, and a setting the box left empty (a video taken away, no height,
 * the banner shown) is left out, which is what removes it. The `metadata` passed
 * in is not changed.
 */
export const withHomeBanner = (
  metadata: Record<string, unknown> | null | undefined,
  form: HomeBannerForm
): Record<string, unknown> => {
  const banner = normalizeHomeBanner(form)
  const settings: Record<string, string> = {
    [HOME_BANNER_KEYS.video]: banner.video,
    [HOME_BANNER_KEYS.poster]: banner.poster,
    [HOME_BANNER_KEYS.heightDesktop]: banner.heightDesktop,
    [HOME_BANNER_KEYS.heightMobile]: banner.heightMobile,
    [HOME_BANNER_KEYS.hidden]: banner.hidden ? "true" : "",
  }

  const saved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!BANNER_KEY_NAMES.includes(key)) {
      saved[key] = value
    }
  }
  for (const [key, value] of Object.entries(settings)) {
    if (value) {
      saved[key] = value
    }
  }
  return saved
}
