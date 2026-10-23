import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  deleteBlogPostStep,
  DeleteBlogPostStepInput,
} from "./steps/delete-blog-post"
import { deleteRecordTranslationsStep } from "./steps/delete-record-translations"

export type DeleteBlogPostWorkflowInput = DeleteBlogPostStepInput

const deleteBlogPostWorkflow = createWorkflow(
  "delete-blog-post",
  function (input: DeleteBlogPostWorkflowInput) {
    const result = deleteBlogPostStep(input)

    // Its translations go with it.
    deleteRecordTranslationsStep({ reference: "blog_post", id: input.id })

    return new WorkflowResponse(result)
  }
)

export default deleteBlogPostWorkflow
