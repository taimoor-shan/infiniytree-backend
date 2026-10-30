import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { NOTIFY_ME_MODULE } from "../../modules/notify-me"
import NotifyMeModuleService from "../../modules/notify-me/service"

export type CreateNotifyMeRequestStepInput = {
  email: string
  product_id: string
  /** Left out when the signup is for the product as a whole. */
  variant_id?: string
  product_url?: string
}

export type NotifyMeRequestRecord = {
  id: string
  email: string
  product_id: string
  variant_id: string | null
  product_title: string | null
  variant_title: string | null
  product_url: string | null
  created_at: Date | string
}

export type CreateNotifyMeRequestStepOutput = {
  request: NotifyMeRequestRecord
  /** False when this email had already signed up for the same product and variant. */
  created: boolean
}

export const createNotifyMeRequestStep = createStep(
  "create-notify-me-request",
  async (input: CreateNotifyMeRequestStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const service: NotifyMeModuleService = container.resolve(NOTIFY_ME_MODULE)

    // Titles come from the catalog, not from the visitor's request.
    const {
      data: [product],
    } = await query.graph({
      entity: "product",
      fields: ["id", "title", "variants.id", "variants.title"],
      filters: { id: input.product_id },
    })

    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
    }

    const variant = input.variant_id
      ? product.variants?.find((v: any) => v?.id === input.variant_id)
      : undefined

    if (input.variant_id && !variant) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "That variant does not belong to this product"
      )
    }

    // The address is stored lower-case so the same person is not listed twice.
    const email = input.email.trim().toLowerCase()
    const variantId = variant?.id ?? null

    const [existing] = await service.listNotifyMeRequests(
      { email, product_id: product.id, variant_id: variantId },
      { take: 1 }
    )

    // Nothing was created, so there is nothing to undo if a later step fails.
    if (existing) {
      return new StepResponse<CreateNotifyMeRequestStepOutput, string | null>(
        { request: existing, created: false },
        null
      )
    }

    const request = await service.createNotifyMeRequests({
      email,
      product_id: product.id,
      variant_id: variantId,
      product_title: product.title ?? null,
      variant_title: variant?.title ?? null,
      product_url: input.product_url ?? null,
    })

    return new StepResponse<CreateNotifyMeRequestStepOutput, string | null>(
      { request, created: true },
      request.id
    )
  },
  async (id: string | null, { container }) => {
    if (!id) {
      return
    }
    const service: NotifyMeModuleService = container.resolve(NOTIFY_ME_MODULE)
    await service.deleteNotifyMeRequests(id)
  }
)
