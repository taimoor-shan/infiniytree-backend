import { Module } from "@medusajs/framework/utils"
import DeliveryRequestModuleService from "./service"

export const DELIVERY_REQUEST_MODULE = "deliveryRequest"

export default Module(DELIVERY_REQUEST_MODULE, {
  service: DeliveryRequestModuleService,
})
