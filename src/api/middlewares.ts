import { defineMiddlewares } from "@medusajs/framework/http"
import { pageAdminMiddlewares } from "./admin/pages/middlewares"
import { pageStoreMiddlewares } from "./store/pages/middlewares"
import { contactStoreMiddlewares } from "./store/contact/middlewares"
import { notifyMeStoreMiddlewares } from "./store/notify-me/middlewares"
import { guestOrderMiddlewares } from "./store/orders/guest/[displayId]/middlewares"
import { guestInvoiceMiddlewares } from "./invoice/guest/[displayId]/middlewares"

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

/**
 * Reject admin uploads larger than 20 MB before multer buffers them into RAM.
 *
 * The framework's `/admin/uploads` route uses `multer({ storage: multer.memoryStorage() })`
 * with no size cap, so a 200 MB file would be fully buffered before any handler
 * runs and exhaust memory under load. This guard reads the `Content-Length`
 * header (set by the browser before the body is sent) and short-circuits with
 * 413 when the request would exceed 20 MB.
 *
 * It runs before multer because user-defined middlewares (registered here) are
 * concatenated with the framework's routes in registration order, then sorted
 * by `RoutesSorter`. The user middlewares come first, so this check fires
 * before multer touches the body.
 *
 * 20 MB matches the documented limit for the admin hero-video field. Loosen
 * the constant if more video sources are added.
 */
const enforceUploadSize = (req, res, next) => {
  const header = req.headers["content-length"]
  const length = Array.isArray(header) ? parseInt(header[0], 10) : parseInt(header, 10)

  if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES) {
    return res.status(413).json({
      type: "invalid_data",
      message: `Upload exceeds 20 MB limit (received ${length} bytes)`,
    })
  }

  return next()
}

export default defineMiddlewares({
  routes: [
    ...pageAdminMiddlewares,
    ...pageStoreMiddlewares,
    ...contactStoreMiddlewares,
    ...notifyMeStoreMiddlewares,
    ...guestOrderMiddlewares,
    ...guestInvoiceMiddlewares,
    {
      matcher: "/admin/uploads",
      method: "POST",
      middlewares: [enforceUploadSize],
    },
    {
      matcher: "/admin/uploads/*",
      method: "POST",
      middlewares: [enforceUploadSize],
    },
  ],
})
