import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  deleteShippingCurrencyRateStep,
  DeleteShippingCurrencyRateStepInput,
} from "./steps/delete-shipping-currency-rate"

export type DeleteShippingCurrencyRateWorkflowInput =
  DeleteShippingCurrencyRateStepInput

const deleteShippingCurrencyRateWorkflow = createWorkflow(
  "delete-shipping-currency-rate",
  function (input: DeleteShippingCurrencyRateWorkflowInput) {
    const result = deleteShippingCurrencyRateStep(input)

    return new WorkflowResponse(result)
  }
)

export default deleteShippingCurrencyRateWorkflow
