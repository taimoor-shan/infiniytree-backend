/**
 * The product video. It lives in the product's metadata, where the storefront's
 * gallery reads it (`src/lib/util/product-video.ts` there reads the same keys):
 *   video_url     the video file, MP4 or WebM
 *   video_poster  the still image with the play button on it, in the thumbnails
 *                 and before the video plays (optional: the product's first
 *                 image stands in)
 */
export const VIDEO_KEY = "video_url"
export const POSTER_KEY = "video_poster"

export type ProductVideoForm = {
  video: string
  poster: string
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

export const readProductVideo = (
  metadata?: Record<string, unknown> | null
): ProductVideoForm => ({
  video: text(metadata?.[VIDEO_KEY]),
  poster: text(metadata?.[POSTER_KEY]),
})

/**
 * A still image without a video does nothing, so taking the video away takes
 * its still image with it, and the form is compared and saved in this shape.
 */
export const normalizeProductVideo = (
  form: ProductVideoForm
): ProductVideoForm => {
  const video = form.video.trim()
  return { video, poster: video ? form.poster.trim() : "" }
}

export const sameProductVideo = (a: ProductVideoForm, b: ProductVideoForm) => {
  const [x, y] = [normalizeProductVideo(a), normalizeProductVideo(b)]
  return x.video === y.video && x.poster === y.poster
}

/**
 * What the storefront can load: a web address, or a path on its own origin
 * (`/static/…`, where uploads are served). Keep in step with `asMediaUrl()` in
 * the storefront's `src/lib/util/product-video.ts`, which drops anything else.
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
    return "YouTube and Vimeo pages cannot be played in the gallery. Upload the video file (MP4 or WebM), or link to the file itself."
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

/**
 * The metadata to send. Medusa merges it into the product's other metadata and
 * removes a key whose value is an empty string, which is how a video is taken
 * away. Nothing else in the metadata is touched.
 */
export const videoMetadata = (
  form: ProductVideoForm
): Record<string, string> => {
  const { video, poster } = normalizeProductVideo(form)
  return { [VIDEO_KEY]: video, [POSTER_KEY]: poster }
}
