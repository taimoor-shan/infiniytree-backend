import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  setNewsletterStatusStep,
  SetNewsletterStatusStepInput,
} from "./steps/set-newsletter-status"

const setNewsletterStatusWorkflow = createWorkflow(
  "set-newsletter-status",
  function (input: SetNewsletterStatusStepInput) {
    return new WorkflowResponse(setNewsletterStatusStep(input))
  }
)

export default setNewsletterStatusWorkflow
