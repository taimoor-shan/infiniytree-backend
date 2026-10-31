import {
  AbstractFulfillmentProviderService,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
  ICartModuleService,
} from "@medusajs/framework/types"
import { SHIPPING_RATES_MODULE } from "../shipping-rates"
import { quoteFromStore } from "../shipping-rates/lib/quote"
import { RateLookupError } from "../shipping-rates/lib/rates"
import type ShippingRatesModuleService from "../shipping-rates/service"

/** What the cart tells the provider; only what the price depends on. */
type PriceContext = {
  /** The cart's id. */
  id?: string
  currency_code?: string | null
  shipping_address?: {
    country_code?: string | null
    postal_code?: string | null
  } | null
  /** Already narrowed to the items of the shipping option's shipping profile. */
  items?: { quantity?: number | string | null; requires_shipping?: boolean }[]
}

/** Classes offered before any rates are saved, so a shipping option can be made first. */
const BUILT_IN_CLASSES = ["pallet", "carton"]

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)

/**
 * Prices a delivery from the rates saved in the `shippingRates` module
 * (Settings -> Shipping rates in the admin), so the figures change without
 * code. A shipping option of this provider is `calculated` and picks its
 * rates by the fulfillment option it was made with: the option's id is the
 * shipping class (`pallet`, `carton`).
 *
 * The price is the units in the cart under the option's shipping profile
 * (a pallet product counts one pallet per unit, a carton product one carton),
 * priced for the delivery country and postcode, in the cart's currency and
 * without tax. A cart with pallet and carton products has a shipping method
 * for each profile, and the customer pays both.
 *
 * Medusa calls `calculatePrice` whenever the cart changes, and an error here
 * stops that change. That is deliberate: a delivery with no rate (a country
 * or a currency nobody entered) must not be sold at a made-up price, so the
 * error says what is missing.
 */
class TariffFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "tariff"

  // The module's container. The rates module is read when needed, not when
  // this provider is built, so the order the modules load in does not matter.
  protected container_: Record<string, unknown>

  constructor(container: Record<string, unknown>) {
    super()
    this.container_ = container
  }

  protected get rates_(): ShippingRatesModuleService {
    return this.container_[
      SHIPPING_RATES_MODULE
    ] as ShippingRatesModuleService
  }

  /**
   * The currency to charge in. Medusa passes it when a delivery is added to a
   * cart, but its "calculate price" endpoint (what the storefront lists the
   * prices with) hands over the cart without it, so it is read from the cart.
   * Never assumed to be euro: that would list a forint cart's delivery in
   * euro amounts.
   */
  protected async currencyOf_(cart: PriceContext): Promise<string> {
    if (cart.currency_code) {
      return cart.currency_code
    }

    if (cart.id) {
      const carts = this.container_[Modules.CART] as ICartModuleService
      const row = await carts.retrieveCart(cart.id, {
        select: ["id", "currency_code"],
      })
      if (row.currency_code) {
        return row.currency_code
      }
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The currency of the cart is needed to work out the delivery price."
    )
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    const classes = new Set(BUILT_IN_CLASSES)
    const tables = await this.rates_.listShippingRateTables(
      {},
      { select: ["id", "shipping_class"] }
    )
    for (const table of tables) {
      classes.add(table.shipping_class)
    }

    return [...classes].sort().map((id) => ({
      id,
      name: `${titleCase(id)} delivery (rate table)`,
    }))
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return typeof data?.id === "string" && data.id.length > 0
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return data
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const cart = context as PriceContext
    const shippingClass = String(optionData?.id ?? "")

    if (!shippingClass) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This shipping option has no shipping class. Edit it and pick a fulfillment option."
      )
    }

    const units = (cart.items ?? [])
      .filter((item) => item.requires_shipping !== false)
      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

    // Nothing of this class is in the cart (its items were just removed), so
    // there is nothing to charge for; the cart drops the method on its own.
    if (units < 1) {
      return { calculated_amount: 0, is_calculated_price_tax_inclusive: false }
    }

    const country = cart.shipping_address?.country_code
    if (!country) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The delivery country is needed to work out the delivery price."
      )
    }

    try {
      const quote = await quoteFromStore(this.rates_, {
        shipping_class: shippingClass,
        country_code: country,
        postcode: cart.shipping_address?.postal_code,
        units,
        currency_code: await this.currencyOf_(cart),
      })

      return {
        calculated_amount: quote.charge,
        // The rates are net: tax is added on top by the cart.
        is_calculated_price_tax_inclusive: false,
      }
    } catch (error) {
      if (error instanceof RateLookupError) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message)
      }
      throw error
    }
  }

  // Nothing is booked with a carrier: the shop prepares the shipment itself.
  async createFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<any> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}

export default TariffFulfillmentService
