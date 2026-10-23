import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  updateBlogPostStep,
  UpdateBlogPostStepInput,
} from "./steps/update-blog-post"

export type UpdateBlogPostWorkflowInput = UpdateBlogPostStepInput

const updateBlogPostWorkflow = createWorkflow(
  "update-blog-post",
  function (input: UpdateBlogPostWorkflowInput) {
    const post = updateBlogPostStep(input)

    return new WorkflowResponse({ post })
  }
)

export default updateBlogPostWorkflow
