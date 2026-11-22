import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  subscribeNewsletterStep,
  SubscribeNewsletterStepInput,
} from "./steps/subscribe-newsletter"
import { sendNewsletterConfirmationStep } from "./steps/send-newsletter-confirmation"

const subscribeNewsletterWorkflow = createWorkflow(
  "subscribe-newsletter",
  function (input: SubscribeNewsletterStepInput) {
    const result = subscribeNewsletterStep(input)
    sendNewsletterConfirmationStep(result)
    return new WorkflowResponse(result)
  }
)

export default subscribeNewsletterWorkflow
