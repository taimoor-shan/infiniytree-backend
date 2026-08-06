import { defineMiddlewares } from "@medusajs/framework/http"
import { pageAdminMiddlewares } from "./admin/pages/middlewares"
import { pageStoreMiddlewares } from "./store/pages/middlewares"
import { contactStoreMiddlewares } from "./store/contact/middlewares"
import { guestOrderMiddlewares } from "./store/orders/guest/[displayId]/middlewares"
import { guestInvoiceMiddlewares } from "./invoice/guest/[displayId]/middlewares"

export default defineMiddlewares({
  routes: [...pageAdminMiddlewares, ...pageStoreMiddlewares, ...contactStoreMiddlewares, ...guestOrderMiddlewares, ...guestInvoiceMiddlewares],
})
