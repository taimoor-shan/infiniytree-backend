import { MedusaService } from "@medusajs/framework/utils"
import DeliveryRequest from "./models/delivery-request"

class DeliveryRequestModuleService extends MedusaService({
  DeliveryRequest,
}) {}

export default DeliveryRequestModuleService
