import { MedusaService } from "@medusajs/framework/utils"
import NotifyMeRequest from "./models/notify-me-request"

class NotifyMeModuleService extends MedusaService({
  NotifyMeRequest,
}) {}

export default NotifyMeModuleService
