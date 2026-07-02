import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PAGE_MODULE } from "../../modules/page"
import PageModuleService from "../../modules/page/service"

export type CreatePageStepInput = {
  title: string
  slug: string
  content?: string | null
  excerpt?: string | null
  featured_image?: string | null
  seo_title?: string | null
  seo_description?: string | null
  status?: "draft" | "published"
  is_public?: boolean
  metadata?: Record<string, unknown> | null
}

export const createPageStep = createStep(
  "create-page",
  async (input: CreatePageStepInput, { container }) => {
    const pageModuleService: PageModuleService = container.resolve(PAGE_MODULE)

    const created = await pageModuleService.createPages({
      ...input,
    })
    const page = Array.isArray(created) ? created[0] : created

    return new StepResponse(page, page.id)
  },
  async (pageId, { container }) => {
    const pageModuleService: PageModuleService = container.resolve(PAGE_MODULE)
    await pageModuleService.deletePages(pageId)
  }
)
