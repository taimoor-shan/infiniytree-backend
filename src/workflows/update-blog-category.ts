import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  updateBlogCategoryStep,
  UpdateBlogCategoryStepInput,
} from "./steps/update-blog-category"

export type UpdateBlogCategoryWorkflowInput = UpdateBlogCategoryStepInput

const updateBlogCategoryWorkflow = createWorkflow(
  "update-blog-category",
  function (input: UpdateBlogCategoryWorkflowInput) {
    const category = updateBlogCategoryStep(input)

    return new WorkflowResponse({ category })
  }
)

export default updateBlogCategoryWorkflow
