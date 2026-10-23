import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createBlogPostStep,
  CreateBlogPostStepInput,
} from "./steps/create-blog-post"

export type CreateBlogPostWorkflowInput = CreateBlogPostStepInput

const createBlogPostWorkflow = createWorkflow(
  "create-blog-post",
  function (input: CreateBlogPostWorkflowInput) {
    const post = createBlogPostStep(input)

    return new WorkflowResponse({ post })
  }
)

export default createBlogPostWorkflow
