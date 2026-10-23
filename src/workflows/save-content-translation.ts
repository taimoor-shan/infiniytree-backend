import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  saveContentTranslationsStep,
  SaveContentTranslationsInput,
} from "./steps/save-content-translations"

export type SaveContentTranslationWorkflowInput = SaveContentTranslationsInput

/** Saves an editor's own translation (or edit of one) of a page, post or category. */
const saveContentTranslationWorkflow = createWorkflow(
  "save-content-translation",
  function (input: SaveContentTranslationWorkflowInput) {
    const saved = saveContentTranslationsStep(input)

    return new WorkflowResponse(saved)
  }
)

export default saveContentTranslationWorkflow
