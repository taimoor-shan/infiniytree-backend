import { defineMiddlewares } from "@medusajs/framework/http"
import { pageAdminMiddlewares } from "./admin/pages/middlewares"
import { pageStoreMiddlewares } from "./store/pages/middlewares"
import { contactStoreMiddlewares } from "./store/contact/middlewares"

export default defineMiddlewares({
  routes: [...pageAdminMiddlewares, ...pageStoreMiddlewares, ...contactStoreMiddlewares],
})
