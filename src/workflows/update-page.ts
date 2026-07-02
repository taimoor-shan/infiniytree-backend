import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updatePageStep, UpdatePageStepInput } from "./steps/update-page"

export type UpdatePageWorkflowInput = UpdatePageStepInput

const updatePageWorkflow = createWorkflow(
  "update-page",
  function (input: UpdatePageWorkflowInput) {
    const page = updatePageStep(input)

    return new WorkflowResponse({ page })
  }
)

export default updatePageWorkflow
