import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  updateWithdrawalRequestStep,
  UpdateWithdrawalRequestStepInput,
} from "./steps/update-withdrawal-request"

const updateWithdrawalRequestWorkflow = createWorkflow(
  "update-withdrawal-request",
  function (input: UpdateWithdrawalRequestStepInput) {
    return new WorkflowResponse(updateWithdrawalRequestStep(input))
  }
)

export default updateWithdrawalRequestWorkflow
