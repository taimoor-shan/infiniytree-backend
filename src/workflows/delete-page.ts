import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { deletePageStep, DeletePageStepInput } from "./steps/delete-page"
import { deleteRecordTranslationsStep } from "./steps/delete-record-translations"

export type DeletePageWorkflowInput = DeletePageStepInput

const deletePageWorkflow = createWorkflow(
  "delete-page",
  function (input: DeletePageWorkflowInput) {
    const result = deletePageStep(input)

    // Its translations go with it.
    deleteRecordTranslationsStep({ reference: "page", id: input.id })

    return new WorkflowResponse(result)
  }
)

export default deletePageWorkflow
