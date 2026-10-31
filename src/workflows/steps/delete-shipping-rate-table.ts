import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { SHIPPING_RATES_MODULE } from "../../modules/shipping-rates"
import ShippingRatesModuleService from "../../modules/shipping-rates/service"

export type DeleteShippingRateTableStepInput = {
  id: string
}

type Undo = {
  shipping_class: string
  country_code: string
  zones: unknown
  tiers: unknown
}

export const deleteShippingRateTableStep = createStep(
  "delete-shipping-rate-table",
  async (input: DeleteShippingRateTableStepInput, { container }) => {
    const service: ShippingRatesModuleService =
      container.resolve(SHIPPING_RATES_MODULE)

    // Throws when there is no such table, so deleting twice answers 404.
    const table = await service.retrieveShippingRateTable(input.id)
    await service.deleteShippingRateTables(input.id)

    return new StepResponse<{ id: string }, Undo>(
      { id: input.id },
      {
        shipping_class: table.shipping_class,
        country_code: table.country_code,
        zones: table.zones,
        tiers: table.tiers,
      }
    )
  },
  async (undo: Undo | undefined, { container }) => {
    if (!undo) {
      return
    }
    const service: ShippingRatesModuleService =
      container.resolve(SHIPPING_RATES_MODULE)
    await service.createShippingRateTables({
      shipping_class: undo.shipping_class,
      country_code: undo.country_code,
      zones: undo.zones as Record<string, unknown>,
      tiers: undo.tiers as Record<string, unknown>,
    })
  }
)
