import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  saveShippingCurrencyRateStep,
  SaveShippingCurrencyRateStepInput,
} from "./steps/save-shipping-currency-rate"

export type SaveShippingCurrencyRateWorkflowInput =
  SaveShippingCurrencyRateStepInput

const saveShippingCurrencyRateWorkflow = createWorkflow(
  "save-shipping-currency-rate",
  function (input: SaveShippingCurrencyRateWorkflowInput) {
    const rate = saveShippingCurrencyRateStep(input)

    return new WorkflowResponse(rate)
  }
)

export default saveShippingCurrencyRateWorkflow
