import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  updateDeliveryRequestStep,
  UpdateDeliveryRequestStepInput,
} from "./steps/update-delivery-request"

const updateDeliveryRequestWorkflow = createWorkflow(
  "update-delivery-request",
  function (input: UpdateDeliveryRequestStepInput) {
    return new WorkflowResponse(updateDeliveryRequestStep(input))
  }
)

export default updateDeliveryRequestWorkflow
