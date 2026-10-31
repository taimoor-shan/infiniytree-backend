import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  deleteShippingRateTableStep,
  DeleteShippingRateTableStepInput,
} from "./steps/delete-shipping-rate-table"

export type DeleteShippingRateTableWorkflowInput =
  DeleteShippingRateTableStepInput

const deleteShippingRateTableWorkflow = createWorkflow(
  "delete-shipping-rate-table",
  function (input: DeleteShippingRateTableWorkflowInput) {
    const result = deleteShippingRateTableStep(input)

    return new WorkflowResponse(result)
  }
)

export default deleteShippingRateTableWorkflow
