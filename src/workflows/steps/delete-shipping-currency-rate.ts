import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { SHIPPING_RATES_MODULE } from "../../modules/shipping-rates"
import ShippingRatesModuleService from "../../modules/shipping-rates/service"

export type DeleteShippingCurrencyRateStepInput = {
  id: string
}

type Undo = { currency_code: string; rate: number }

export const deleteShippingCurrencyRateStep = createStep(
  "delete-shipping-currency-rate",
  async (input: DeleteShippingCurrencyRateStepInput, { container }) => {
    const service: ShippingRatesModuleService =
      container.resolve(SHIPPING_RATES_MODULE)

    // Throws when there is no such rate, so deleting twice answers 404.
    const rate = await service.retrieveShippingRateCurrency(input.id)
    await service.deleteShippingRateCurrencies(input.id)

    return new StepResponse<{ id: string }, Undo>(
      { id: input.id },
      { currency_code: rate.currency_code, rate: Number(rate.rate) }
    )
  },
  async (undo: Undo | undefined, { container }) => {
    if (!undo) {
      return
    }
    const service: ShippingRatesModuleService =
      container.resolve(SHIPPING_RATES_MODULE)
    await service.createShippingRateCurrencies(undo)
  }
)
