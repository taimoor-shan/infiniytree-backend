import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createDeliveryRequestStep,
  CreateDeliveryRequestStepInput,
} from "./steps/create-delivery-request"
import { sendDeliveryRequestAlertStep } from "./steps/send-delivery-request-alert"

export type CreateDeliveryRequestWorkflowInput = CreateDeliveryRequestStepInput

const createDeliveryRequestWorkflow = createWorkflow(
  "create-delivery-request",
  function (input: CreateDeliveryRequestWorkflowInput) {
    const result = createDeliveryRequestStep(input)

    sendDeliveryRequestAlertStep(result)

    return new WorkflowResponse(result)
  }
)

export default createDeliveryRequestWorkflow
