import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  deleteBlogCategoryStep,
  DeleteBlogCategoryStepInput,
} from "./steps/delete-blog-category"
import { deleteRecordTranslationsStep } from "./steps/delete-record-translations"

export type DeleteBlogCategoryWorkflowInput = DeleteBlogCategoryStepInput

const deleteBlogCategoryWorkflow = createWorkflow(
  "delete-blog-category",
  function (input: DeleteBlogCategoryWorkflowInput) {
    const result = deleteBlogCategoryStep(input)

    // Its translations go with it.
    deleteRecordTranslationsStep({ reference: "blog_category", id: input.id })

    return new WorkflowResponse(result)
  }
)

export default deleteBlogCategoryWorkflow
