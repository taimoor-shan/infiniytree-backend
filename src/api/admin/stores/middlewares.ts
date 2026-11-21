import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { revalidateStorefrontCache } from "../../../utils/revalidate-cache"

/**
 * What the storefront keeps from the store: its name and metadata (the homepage
 * video banner lives there, see `src/admin/lib/home-banner.ts`) and its
 * languages. The same pair as the `store.` entry of
 * `src/subscribers/cache-revalidation.ts`.
 */
const STORE_TAGS = ["store", "locales"]

/**
 * Asks the storefront to refresh what it keeps from the store once a store
 * update has been saved.
 *
 * Medusa announces nothing when a store changes: the store module emits no
 * `store.updated` event and `updateStoresWorkflow` has no event step (the region
 * workflows do), so the `store.` entry of the cache subscriber never fires and
 * the storefront would show an edit only when its 5-minute cache runs out. This
 * runs on the admin's own store update, the one the Store settings and the
 * homepage banner box both use, so any change reaches the site at once.
 *
 * It waits for the response to be sent: by then the change is saved, so the
 * storefront's next request reads it, and the editor is not kept waiting for the
 * storefront. A refused update changes nothing and refreshes nothing, and a
 * storefront that cannot be reached is only logged (`revalidateStorefrontCache`).
 */
export const refreshStorefrontAfterStoreUpdate = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  res.once("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void revalidateStorefrontCache(
        STORE_TAGS,
        req.scope.resolve(ContainerRegistrationKeys.LOGGER)
      )
    }
  })

  return next()
}

export const storeAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/stores/:id",
    method: "POST",
    middlewares: [refreshStorefrontAfterStoreUpdate],
  },
]
