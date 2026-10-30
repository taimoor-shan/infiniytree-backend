import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createNotifyMeRequestStep,
  CreateNotifyMeRequestStepInput,
} from "./steps/create-notify-me-request"
import { sendNotifyMeAlertStep } from "./steps/send-notify-me-alert"

export type CreateNotifyMeRequestWorkflowInput = CreateNotifyMeRequestStepInput

const createNotifyMeRequestWorkflow = createWorkflow(
  "create-notify-me-request",
  function (input: CreateNotifyMeRequestWorkflowInput) {
    const result = createNotifyMeRequestStep(input)

    sendNotifyMeAlertStep(result)

    return new WorkflowResponse(result)
  }
)

export default createNotifyMeRequestWorkflow
