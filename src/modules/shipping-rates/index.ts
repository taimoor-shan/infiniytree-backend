import { Module } from "@medusajs/framework/utils"
import ShippingRatesModuleService from "./service"

export const SHIPPING_RATES_MODULE = "shippingRates"

export default Module(SHIPPING_RATES_MODULE, {
  service: ShippingRatesModuleService,
})
