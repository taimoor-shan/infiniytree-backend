import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  deleteNotifyMeRequestStep,
  DeleteNotifyMeRequestStepInput,
} from "./steps/delete-notify-me-request"

export type DeleteNotifyMeRequestWorkflowInput = DeleteNotifyMeRequestStepInput

const deleteNotifyMeRequestWorkflow = createWorkflow(
  "delete-notify-me-request",
  function (input: DeleteNotifyMeRequestWorkflowInput) {
    const result = deleteNotifyMeRequestStep(input)

    return new WorkflowResponse(result)
  }
)

export default deleteNotifyMeRequestWorkflow
