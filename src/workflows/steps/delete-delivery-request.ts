import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DELIVERY_REQUEST_MODULE } from "../../modules/delivery-request"
import DeliveryRequestModuleService from "../../modules/delivery-request/service"

export type DeleteDeliveryRequestStepInput = {
  id: string
}

export const deleteDeliveryRequestStep = createStep(
  "delete-delivery-request",
  async (input: DeleteDeliveryRequestStepInput, { container }) => {
    const service: DeliveryRequestModuleService = container.resolve(
      DELIVERY_REQUEST_MODULE
    )

    // Throws when there is no such request, so deleting twice answers 404.
    await service.retrieveDeliveryRequest(input.id)
    await service.softDeleteDeliveryRequests(input.id)

    return new StepResponse({ id: input.id }, input.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: DeliveryRequestModuleService = container.resolve(
      DELIVERY_REQUEST_MODULE
    )
    await service.restoreDeliveryRequests(id)
  }
)
