import { MedusaService } from "@medusajs/framework/utils"
import ShippingRateCurrency from "./models/shipping-rate-currency"
import ShippingRateTable from "./models/shipping-rate-table"

class ShippingRatesModuleService extends MedusaService({
  ShippingRateTable,
  ShippingRateCurrency,
}) {}

export default ShippingRatesModuleService
