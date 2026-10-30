import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { NOTIFY_ME_MODULE } from "../../modules/notify-me"
import NotifyMeModuleService from "../../modules/notify-me/service"

export type DeleteNotifyMeRequestStepInput = {
  id: string
}

export const deleteNotifyMeRequestStep = createStep(
  "delete-notify-me-request",
  async (input: DeleteNotifyMeRequestStepInput, { container }) => {
    const service: NotifyMeModuleService = container.resolve(NOTIFY_ME_MODULE)

    // Throws when there is no such signup, so deleting twice answers 404.
    await service.retrieveNotifyMeRequest(input.id)
    await service.deleteNotifyMeRequests(input.id)

    return new StepResponse({ id: input.id })
  }
)
