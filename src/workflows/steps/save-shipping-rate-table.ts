import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { SHIPPING_RATES_MODULE } from "../../modules/shipping-rates"
import {
  normalizeTable,
  RateTable,
  validateTable,
} from "../../modules/shipping-rates/lib/rates"
import ShippingRatesModuleService from "../../modules/shipping-rates/service"

export type SaveShippingRateTableStepInput = RateTable

export type ShippingRateTableRecord = RateTable & { id: string }

type Undo =
  | { created_id: string }
  | { id: string; zones: unknown; tiers: unknown }

// The columns hold arrays; the model types a JSON column as an object.
const asJson = (value: unknown) => value as Record<string, unknown>

/**
 * Saves the rates of one shipping class and country: creates the table, or
 * replaces its zones and rows when it exists. The table is cleaned and checked
 * first, and a table that cannot price a delivery is refused with the reasons.
 */
export const saveShippingRateTableStep = createStep(
  "save-shipping-rate-table",
  async (input: SaveShippingRateTableStepInput, { container }) => {
    const service: ShippingRatesModuleService =
      container.resolve(SHIPPING_RATES_MODULE)

    const table = normalizeTable(input)
    const problems = validateTable(table)
    if (problems.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, problems.join(" "))
    }

    const [existing] = await service.listShippingRateTables(
      { shipping_class: table.shipping_class, country_code: table.country_code },
      { take: 1 }
    )

    if (existing) {
      const saved = await service.updateShippingRateTables({
        id: existing.id,
        zones: asJson(table.zones),
        tiers: asJson(table.tiers),
      })
      return new StepResponse<ShippingRateTableRecord, Undo>(
        { id: saved.id, ...table },
        { id: existing.id, zones: existing.zones, tiers: existing.tiers }
      )
    }

    const created = await service.createShippingRateTables({
      shipping_class: table.shipping_class,
      country_code: table.country_code,
      zones: asJson(table.zones),
      tiers: asJson(table.tiers),
    })
    return new StepResponse<ShippingRateTableRecord, Undo>(
      { id: created.id, ...table },
      { created_id: created.id }
    )
  },
  async (undo: Undo | undefined, { container }) => {
    if (!undo) {
      return
    }
    const service: ShippingRatesModuleService =
      container.resolve(SHIPPING_RATES_MODULE)

    if ("created_id" in undo) {
      await service.deleteShippingRateTables(undo.created_id)
    } else {
      await service.updateShippingRateTables({
        id: undo.id,
        zones: asJson(undo.zones),
        tiers: asJson(undo.tiers),
      })
    }
  }
)
