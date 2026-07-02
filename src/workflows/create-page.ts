import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createPageStep, CreatePageStepInput } from "./steps/create-page"

export type CreatePageWorkflowInput = CreatePageStepInput

const createPageWorkflow = createWorkflow(
  "create-page",
  function (input: CreatePageWorkflowInput) {
    const page = createPageStep(input)

    return new WorkflowResponse({ page })
  }
)

export default createPageWorkflow
