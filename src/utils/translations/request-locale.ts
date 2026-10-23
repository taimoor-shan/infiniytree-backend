import type { MedusaRequest } from "@medusajs/framework/http"

/**
 * The language a storefront visitor asked for, from `?locale=` or the
 * `x-medusa-locale` header.
 *
 * With the translation feature on, Medusa's `applyLocale` middleware runs on
 * every `/store` route. It resolves both onto `req.locale` and then **deletes**
 * `locale` from `req.query`, so neither a handler nor a validated query schema
 * ever sees the parameter. That is why `GET /store/pages/:slug` reads the URL
 * by hand. `req.locale` is the framework's own answer; the URL is the fallback
 * for a request where the middleware did not run.
 */
export function requestLocale(req: MedusaRequest): string | undefined {
  return (
    req.locale ||
    new URL(req.url, "http://localhost").searchParams.get("locale") ||
    undefined
  )
}
