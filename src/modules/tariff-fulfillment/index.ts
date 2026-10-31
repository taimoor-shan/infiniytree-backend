import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import TariffFulfillmentService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [TariffFulfillmentService],
})
