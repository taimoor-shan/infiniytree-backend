import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  deleteContentTranslationStep,
  DeleteContentTranslationInput,
} from "./steps/delete-content-translation"

export type DeleteContentTranslationWorkflowInput = DeleteContentTranslationInput

/** Removes one language's translation of a page, post or category. */
const deleteContentTranslationWorkflow = createWorkflow(
  "delete-content-translation",
  function (input: DeleteContentTranslationWorkflowInput) {
    const result = deleteContentTranslationStep(input)

    return new WorkflowResponse(result)
  }
)

export default deleteContentTranslationWorkflow
