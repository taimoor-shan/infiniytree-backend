import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { deletePageStep, DeletePageStepInput } from "./steps/delete-page"

export type DeletePageWorkflowInput = DeletePageStepInput

const deletePageWorkflow = createWorkflow(
  "delete-page",
  function (input: DeletePageWorkflowInput) {
    const result = deletePageStep(input)

    return new WorkflowResponse(result)
  }
)

export default deletePageWorkflow
