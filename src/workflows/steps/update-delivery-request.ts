import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DELIVERY_REQUEST_MODULE } from "../../modules/delivery-request"
import DeliveryRequestModuleService from "../../modules/delivery-request/service"

export type UpdateDeliveryRequestStepInput = {
  id: string
  status: "new" | "handled"
}

export const updateDeliveryRequestStep = createStep(
  "update-delivery-request",
  async (input: UpdateDeliveryRequestStepInput, { container }) => {
    const service: DeliveryRequestModuleService = container.resolve(
      DELIVERY_REQUEST_MODULE
    )

    // Throws when there is no such request, so the route answers 404.
    const previous = await service.retrieveDeliveryRequest(input.id)
    const request = await service.updateDeliveryRequests({
      id: input.id,
      status: input.status,
    })

    return new StepResponse(request, {
      id: input.id,
      status: previous.status,
    })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: DeliveryRequestModuleService = container.resolve(
      DELIVERY_REQUEST_MODULE
    )
    await service.updateDeliveryRequests(previous)
  }
)
