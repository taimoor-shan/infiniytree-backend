import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { DELIVERY_REQUEST_MODULE } from "../../modules/delivery-request"
import DeliveryRequestModuleService from "../../modules/delivery-request/service"

export type CreateDeliveryRequestStepInput = {
  cart_id: string
  email: string
  first_name?: string
  last_name?: string
  company?: string
  vat_number?: string
  phone?: string
  address_1?: string
  address_2?: string
  postal_code?: string
  city?: string
  province?: string
  country_code: string
  message?: string
  locale?: string
}

export type DeliveryRequestItem = {
  title: string
  variant_title: string | null
  sku: string | null
  quantity: number
  unit_price: number
  product_id: string | null
  variant_id: string | null
}

export type DeliveryRequestRecord = {
  id: string
  status: "new" | "handled"
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  vat_number: string | null
  phone: string | null
  address_1: string | null
  address_2: string | null
  postal_code: string | null
  city: string | null
  province: string | null
  country_code: string
  message: string | null
  locale: string | null
  cart_id: string | null
  currency_code: string | null
  item_subtotal: number | null
  items: DeliveryRequestItem[] | null
  created_at: Date | string
}

export type CreateDeliveryRequestStepOutput = {
  request: DeliveryRequestRecord
  /** False when the same cart had already sent a request, which was updated. */
  created: boolean
}

type Compensation =
  | { action: "delete"; id: string }
  | { action: "restore"; previous: DeliveryRequestRecord }

const blankToNull = (value?: string) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Saves a delivery quote request. The products, quantities and prices are read
 * from the cart itself, never from the request body, and a cart without
 * products is refused (which also keeps casual bots out: they need a real cart).
 *
 * A cart sends one request: sending again (a corrected address, another note)
 * updates it instead of listing the customer twice.
 */
export const createDeliveryRequestStep = createStep(
  "create-delivery-request",
  async (input: CreateDeliveryRequestStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const service: DeliveryRequestModuleService = container.resolve(
      DELIVERY_REQUEST_MODULE
    )

    const {
      data: [cart],
    } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "currency_code",
        "completed_at",
        "item_subtotal",
        "items.title",
        "items.product_title",
        "items.variant_title",
        "items.variant_sku",
        "items.quantity",
        "items.unit_price",
        "items.product_id",
        "items.variant_id",
      ],
      filters: { id: input.cart_id },
    })

    if (!cart) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
    }

    const items: DeliveryRequestItem[] = (cart.items ?? [])
      .filter(Boolean)
      .map((item: any) => ({
        title: item.product_title || item.title || "",
        variant_title: item.variant_title ?? null,
        sku: item.variant_sku ?? null,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        product_id: item.product_id ?? null,
        variant_id: item.variant_id ?? null,
      }))

    if (!items.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The cart is empty"
      )
    }

    const data = {
      email: input.email.trim().toLowerCase(),
      first_name: blankToNull(input.first_name),
      last_name: blankToNull(input.last_name),
      company: blankToNull(input.company),
      vat_number: blankToNull(input.vat_number),
      phone: blankToNull(input.phone),
      address_1: blankToNull(input.address_1),
      address_2: blankToNull(input.address_2),
      postal_code: blankToNull(input.postal_code),
      city: blankToNull(input.city),
      province: blankToNull(input.province),
      country_code: input.country_code.trim().toLowerCase(),
      message: blankToNull(input.message),
      locale: blankToNull(input.locale),
      cart_id: cart.id,
      currency_code: cart.currency_code ?? null,
      item_subtotal:
        cart.item_subtotal == null ? null : Number(cart.item_subtotal),
      // A JSON column; the model types it as an object.
      items: items as unknown as Record<string, unknown>,
    }

    const [existing] = await service.listDeliveryRequests(
      { cart_id: cart.id },
      { take: 1, order: { created_at: "DESC" } }
    )

    if (existing) {
      const request = await service.updateDeliveryRequests({
        id: existing.id,
        ...data,
        status: "new",
      })

      return new StepResponse<CreateDeliveryRequestStepOutput, Compensation>(
        { request: request as any, created: false },
        { action: "restore", previous: existing as any }
      )
    }

    const request = await service.createDeliveryRequests(data)

    return new StepResponse<CreateDeliveryRequestStepOutput, Compensation>(
      { request: request as any, created: true },
      { action: "delete", id: request.id }
    )
  },
  async (compensation: Compensation | undefined, { container }) => {
    if (!compensation) {
      return
    }
    const service: DeliveryRequestModuleService = container.resolve(
      DELIVERY_REQUEST_MODULE
    )
    if (compensation.action === "delete") {
      await service.deleteDeliveryRequests(compensation.id)
      return
    }
    const { created_at, ...previous } = compensation.previous as any
    delete previous.updated_at
    delete previous.deleted_at
    await service.updateDeliveryRequests(previous)
  }
)
