import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WITHDRAWAL_MODULE } from "../../modules/withdrawal"
import WithdrawalModuleService from "../../modules/withdrawal/service"

export type UpdateWithdrawalRequestStepInput = {
  id: string
  status: "new" | "handled"
}

export const updateWithdrawalRequestStep = createStep(
  "update-withdrawal-request",
  async (input: UpdateWithdrawalRequestStepInput, { container }) => {
    const service: WithdrawalModuleService = container.resolve(WITHDRAWAL_MODULE)
    // Throws when there is no such declaration, so the route answers 404.
    const previous = await service.retrieveWithdrawalRequest(input.id)
    const request = await service.updateWithdrawalRequests({
      id: input.id,
      status: input.status,
    })
    return new StepResponse(request, { id: input.id, status: previous.status })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: WithdrawalModuleService = container.resolve(WITHDRAWAL_MODULE)
    await service.updateWithdrawalRequests(previous)
  }
)
