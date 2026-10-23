import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createBlogCategoryStep,
  CreateBlogCategoryStepInput,
} from "./steps/create-blog-category"

export type CreateBlogCategoryWorkflowInput = CreateBlogCategoryStepInput

const createBlogCategoryWorkflow = createWorkflow(
  "create-blog-category",
  function (input: CreateBlogCategoryWorkflowInput) {
    const category = createBlogCategoryStep(input)

    return new WorkflowResponse({ category })
  }
)

export default createBlogCategoryWorkflow
