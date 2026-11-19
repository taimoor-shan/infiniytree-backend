import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createWithdrawalRequestStep,
  CreateWithdrawalRequestStepInput,
} from "./steps/create-withdrawal-request"
import { sendWithdrawalEmailsStep } from "./steps/send-withdrawal-emails"

const createWithdrawalRequestWorkflow = createWorkflow(
  "create-withdrawal-request",
  function (input: CreateWithdrawalRequestStepInput) {
    const request = createWithdrawalRequestStep(input)
    sendWithdrawalEmailsStep(request)
    return new WorkflowResponse(request)
  }
)

export default createWithdrawalRequestWorkflow
