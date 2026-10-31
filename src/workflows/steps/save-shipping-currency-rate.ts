import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { SHIPPING_RATES_MODULE } from "../../modules/shipping-rates"
import {
  isCurrencyCode,
  normalizeCurrencyCode,
} from "../../modules/shipping-rates/lib/rates"
import ShippingRatesModuleService from "../../modules/shipping-rates/service"

export type SaveShippingCurrencyRateStepInput = {
  currency_code: string
  /** How many units of the currency make one euro. */
  rate: number
}

export type ShippingCurrencyRateRecord = {
  id: string
  currency_code: string
  rate: number
}

type Undo = { created_id: string } | { id: string; rate: number }

/**
 * Saves the exchange rate that turns the euro delivery rates into a cart's
 * currency. The column keeps a rate to about 7 significant digits, so the
 * rate is rounded to 4 decimals before saving.
 */
export const saveShippingCurrencyRateStep = createStep(
  "save-shipping-currency-rate",
  async (input: SaveShippingCurrencyRateStepInput, { container }) => {
    const service: ShippingRatesModuleService =
      container.resolve(SHIPPING_RATES_MODULE)

    const code = normalizeCurrencyCode(input.currency_code)
    if (!isCurrencyCode(code)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The currency is a three-letter code such as huf."
      )
    }
    if (code === "eur") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The delivery rates are in euro, so euro needs no exchange rate."
      )
    }
    const rate = Math.round(Number(input.rate) * 10000) / 10000
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The exchange rate is how many units of the currency make 1 euro, for example 400 for forints."
      )
    }

    const [existing] = await service.listShippingRateCurrencies(
      { currency_code: code },
      { take: 1 }
    )

    if (existing) {
      const saved = await service.updateShippingRateCurrencies({
        id: existing.id,
        rate,
      })
      return new StepResponse<ShippingCurrencyRateRecord, Undo>(
        { id: saved.id, currency_code: code, rate },
        { id: existing.id, rate: Number(existing.rate) }
      )
    }

    const created = await service.createShippingRateCurrencies({
      currency_code: code,
      rate,
    })
    return new StepResponse<ShippingCurrencyRateRecord, Undo>(
      { id: created.id, currency_code: code, rate },
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
      await service.deleteShippingRateCurrencies(undo.created_id)
    } else {
      await service.updateShippingRateCurrencies({
        id: undo.id,
        rate: undo.rate,
      })
    }
  }
)
