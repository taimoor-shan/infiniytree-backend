import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  saveShippingRateTableStep,
  SaveShippingRateTableStepInput,
} from "./steps/save-shipping-rate-table"

export type SaveShippingRateTableWorkflowInput = SaveShippingRateTableStepInput

const saveShippingRateTableWorkflow = createWorkflow(
  "save-shipping-rate-table",
  function (input: SaveShippingRateTableWorkflowInput) {
    const table = saveShippingRateTableStep(input)

    return new WorkflowResponse(table)
  }
)

export default saveShippingRateTableWorkflow
