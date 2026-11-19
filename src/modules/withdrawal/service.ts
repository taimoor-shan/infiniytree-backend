import { MedusaService } from "@medusajs/framework/utils"
import WithdrawalRequest from "./models/withdrawal-request"

class WithdrawalModuleService extends MedusaService({
  WithdrawalRequest,
}) {}

export default WithdrawalModuleService
