import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  deleteDeliveryRequestStep,
  DeleteDeliveryRequestStepInput,
} from "./steps/delete-delivery-request"

const deleteDeliveryRequestWorkflow = createWorkflow(
  "delete-delivery-request",
  function (input: DeleteDeliveryRequestStepInput) {
    return new WorkflowResponse(deleteDeliveryRequestStep(input))
  }
)

export default deleteDeliveryRequestWorkflow
