import {
  ExecArgs,
  IFulfillmentModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  updateProductsWorkflow,
  updateShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows"
import { SHIPPING_RATES_MODULE } from "../modules/shipping-rates"
import {
  INITIAL_CURRENCY_RATES,
  INITIAL_RATE_TABLES,
} from "../modules/shipping-rates/lib/initial-rates"
import ShippingRatesModuleService from "../modules/shipping-rates/service"
import saveShippingCurrencyRateWorkflow from "../workflows/save-shipping-currency-rate"
import saveShippingRateTableWorkflow from "../workflows/save-shipping-rate-table"
import {
  CARTON_PRODUCT_PATTERN,
  DELIVERY_OPTIONS,
  LEGACY_PALLET_PROFILE_NAME,
  PALLET_PRODUCT_PATTERN,
  PALLET_PROFILE,
  CARTON_PROFILE,
  TARIFF_PROVIDER_ID,
} from "./shipping-classes"

type Profile = { id: string; name: string; type: string }

export type SetupShippingResult = {
  /** Shipping profile id by class type (`pallet`, `carton`). */
  profiles: Record<string, string>
  rate_tables_created: string[]
  currency_rates_created: string[]
  shipping_options_created: string[]
  /** Products put in a class by their name. */
  products_assigned: { title: string; class: string }[]
  /** Products matching neither class, left on the profile they have. */
  products_left: { title: string; profile: string | null }[]
}

/**
 * Sets up delivery pricing: the two shipping classes, their rates, and the
 * delivery options that charge them at checkout.
 *
 *   npx medusa exec ./src/scripts/setup-shipping.ts
 *
 * On the server, run it from `.medusa/server` with the built file:
 *   npx medusa exec ./src/scripts/setup-shipping.js
 *
 * Run `npx medusa db:migrate` first (it adds the rates tables). Safe to run
 * twice, and safe to run after rates were edited in the admin: it only adds
 * what is missing and never overwrites a rate table, an exchange rate or a
 * shipping option that exists. It:
 *
 * - makes the "Pallet products" and "Carton products" shipping classes (the
 *   class first called "Pallet product" is renamed);
 * - saves the starting rates (`initial-rates.ts`) for classes and countries
 *   that have none, and the euro-to-forint rate if there is none;
 * - links the `tariff_rates` provider to the shop's stock location and adds
 *   a calculated "Pallet delivery" and "Carton delivery" option to each
 *   delivery zone, so the checkout charges the rates;
 * - puts products in a class by name: Rose Royal and Magnolia in cartons,
 *   Cherry Blossom, Bonsai, Maple, Orchid and Blue Cascade on pallets. Any
 *   other product keeps its profile; assign it in the admin.
 */
export default async function setupShippingScript({ container }: ExecArgs) {
  await setupShipping(container)
}

export async function setupShipping(
  container: MedusaContainer
): Promise<SetupShippingResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    Modules.FULFILLMENT
  )

  const result: SetupShippingResult = {
    profiles: {},
    rate_tables_created: [],
    currency_rates_created: [],
    shipping_options_created: [],
    products_assigned: [],
    products_left: [],
  }

  // 1. The shipping classes
  for (const wanted of [PALLET_PROFILE, CARTON_PROFILE]) {
    const profile = await findOrCreateProfile(container, fulfillmentService, wanted)
    result.profiles[wanted.type] = profile.id
  }

  // 2. The rates
  const rates: ShippingRatesModuleService = container.resolve(
    SHIPPING_RATES_MODULE
  )
  for (const table of INITIAL_RATE_TABLES) {
    const [existing] = await rates.listShippingRateTables(
      {
        shipping_class: table.shipping_class,
        country_code: table.country_code,
      },
      { take: 1 }
    )
    if (existing) {
      continue
    }
    await saveShippingRateTableWorkflow(container).run({ input: table })
    result.rate_tables_created.push(
      `${table.shipping_class}/${table.country_code}`
    )
  }
  for (const [currency, rate] of Object.entries(INITIAL_CURRENCY_RATES)) {
    const [existing] = await rates.listShippingRateCurrencies(
      { currency_code: currency },
      { take: 1 }
    )
    if (existing) {
      continue
    }
    await saveShippingCurrencyRateWorkflow(container).run({
      input: { currency_code: currency, rate },
    })
    result.currency_rates_created.push(currency)
  }

  // 3. The provider at the stock location, and a delivery option per zone
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "fulfillment_providers.id",
      "fulfillment_sets.id",
      "fulfillment_sets.type",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.name",
    ],
  })

  for (const location of locations) {
    const providerIds = (location.fulfillment_providers ?? []).map(
      (provider: { id: string }) => provider.id
    )
    // Only a location that delivers (has a provider and a shipping set) is touched.
    const zones = (location.fulfillment_sets ?? [])
      .filter((set: { type: string }) => set.type === "shipping")
      .flatMap(
        (set: { service_zones?: { id: string; name: string }[] }) =>
          set.service_zones ?? []
      )
    if (!providerIds.length || !zones.length) {
      continue
    }

    if (!providerIds.includes(TARIFF_PROVIDER_ID)) {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: TARIFF_PROVIDER_ID },
      })
    }

    for (const zone of zones) {
      for (const delivery of DELIVERY_OPTIONS) {
        const profileId = result.profiles[delivery.profile.type]
        const [existing] = await fulfillmentService.listShippingOptions(
          {
            service_zone_id: zone.id,
            shipping_profile_id: profileId,
            provider_id: TARIFF_PROVIDER_ID,
          },
          { take: 1 }
        )
        if (existing) {
          continue
        }

        await createShippingOptionsWorkflow(container).run({
          input: [
            {
              name: delivery.name,
              price_type: "calculated",
              provider_id: TARIFF_PROVIDER_ID,
              service_zone_id: zone.id,
              shipping_profile_id: profileId,
              type: {
                label: delivery.name,
                description: delivery.description,
                code: delivery.code,
              },
              // What the admin stores when it picks a fulfillment option; the
              // id is the rate table class.
              data: {
                id: delivery.profile.type,
                name: `${delivery.profile.type.charAt(0).toUpperCase()}${delivery.profile.type.slice(1)} delivery (rate table)`,
              },
              rules: [
                { attribute: "enabled_in_store", value: "true", operator: "eq" },
                { attribute: "is_return", value: "false", operator: "eq" },
              ],
            },
          ],
        })
        result.shipping_options_created.push(`${delivery.name} in ${zone.name}`)
      }
    }
  }

  // 4. The products
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "shipping_profile.id", "shipping_profile.name"],
  })

  const assignments = new Map<string, string[]>()
  for (const product of products) {
    const title: string = product.title ?? ""
    const wanted = CARTON_PRODUCT_PATTERN.test(title)
      ? CARTON_PROFILE
      : PALLET_PRODUCT_PATTERN.test(title)
        ? PALLET_PROFILE
        : null

    if (!wanted) {
      result.products_left.push({
        title,
        profile: product.shipping_profile?.name ?? null,
      })
      continue
    }

    const profileId = result.profiles[wanted.type]
    if (product.shipping_profile?.id === profileId) {
      continue
    }
    assignments.set(profileId, [...(assignments.get(profileId) ?? []), product.id])
    result.products_assigned.push({ title, class: wanted.name })
  }
  for (const [profileId, ids] of assignments) {
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: ids },
        update: { shipping_profile_id: profileId },
      },
    })
  }

  logSummary(logger, result)
  return result
}

async function findOrCreateProfile(
  container: MedusaContainer,
  fulfillmentService: IFulfillmentModuleService,
  wanted: { name: string; type: string }
): Promise<Profile> {
  // Found by type, so a class renamed in the admin is not made again; the
  // name the pallet class first had is the fallback.
  const [byType] = await fulfillmentService.listShippingProfiles({
    type: wanted.type,
  })
  const [existing] = byType
    ? [byType]
    : await fulfillmentService.listShippingProfiles({
        name:
          wanted.type === PALLET_PROFILE.type
            ? [wanted.name, LEGACY_PALLET_PROFILE_NAME]
            : [wanted.name],
      })

  if (existing) {
    if (existing.name === LEGACY_PALLET_PROFILE_NAME) {
      await updateShippingProfilesWorkflow(container).run({
        input: { selector: { id: existing.id }, update: { name: wanted.name } },
      })
    }
    return { id: existing.id, name: wanted.name, type: existing.type }
  }

  const { result } = await createShippingProfilesWorkflow(container).run({
    input: { data: [wanted] },
  })
  return { id: result[0].id, name: wanted.name, type: wanted.type }
}

function logSummary(
  logger: { info: (message: string) => void; warn: (message: string) => void },
  result: SetupShippingResult
) {
  const list = (items: string[]) => (items.length ? items.join(", ") : "none")

  logger.info(
    `Shipping setup: rate tables added: ${list(result.rate_tables_created)}; ` +
      `exchange rates added: ${list(result.currency_rates_created)}; ` +
      `delivery options added: ${list(result.shipping_options_created)}.`
  )
  logger.info(
    `Products put in a class: ${list(
      result.products_assigned.map((p) => `${p.title} -> ${p.class}`)
    )}.`
  )
  if (result.products_left.length) {
    logger.warn(
      `Products left on their own shipping profile (assign a class in the admin if they ship on a pallet or in a carton): ${list(
        result.products_left.map((p) => `${p.title} [${p.profile ?? "none"}]`)
      )}.`
    )
  }
}
