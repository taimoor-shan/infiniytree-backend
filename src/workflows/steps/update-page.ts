import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PAGE_MODULE } from "../../modules/page"
import PageModuleService from "../../modules/page/service"

export type UpdatePageStepInput = {
  id: string
  data: {
    title?: string
    slug?: string
    content?: string | null
    excerpt?: string | null
    featured_image?: string | null
    seo_title?: string | null
    seo_description?: string | null
    status?: "draft" | "published"
    is_public?: boolean
    metadata?: Record<string, unknown> | null
  }
}

export const updatePageStep = createStep(
  "update-page",
  async (input: UpdatePageStepInput, { container }) => {
    const pageModuleService: PageModuleService = container.resolve(PAGE_MODULE)

    const updated = await pageModuleService.updatePages({
      id: input.id,
      ...input.data,
    })
    const page = Array.isArray(updated) ? updated[0] : updated

    return new StepResponse(page)
  }
)
