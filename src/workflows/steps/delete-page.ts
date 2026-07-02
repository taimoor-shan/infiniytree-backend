import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PAGE_MODULE } from "../../modules/page"
import PageModuleService from "../../modules/page/service"

export type DeletePageStepInput = {
  id: string
}

export const deletePageStep = createStep(
  "delete-page",
  async (input: DeletePageStepInput, { container }) => {
    const pageModuleService: PageModuleService = container.resolve(PAGE_MODULE)

    await pageModuleService.deletePages(input.id)

    return new StepResponse({ id: input.id })
  }
)
