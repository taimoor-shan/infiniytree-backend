/**
 * Idempotent tax rate seeding for Infinytree B2B.
 *
 * Business rules:
 *   - Hungary (hu): 27% VAT — standard domestic rate
 *   - Germany (de), Austria (at): 0% — B2B reverse charge (Art. 196 VAT Directive)
 *
 * Run: yarn medusa exec ./src/scripts/seed-tax.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createTaxRegionsWorkflow } from "@medusajs/medusa/core-flows"

const TAX_RATES: Record<string, number> = {
  hu: 27,   // Hungary — standard VAT
  at: 0,    // Austria — reverse charge
  de: 0,    // Germany — reverse charge
}

const DEFAULT_RATE = 0 // any country not listed above gets 0%

export default async function seedTaxData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const taxModuleService = container.resolve(Modules.TAX)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("[seed-tax] Fetching existing regions...")

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "countries.*"],
  })

  if (!regions.length) {
    logger.warn("[seed-tax] No regions found — run the main seed first")
    return
  }

  const countryCodes = new Set<string>()
  for (const region of regions) {
    for (const country of region.countries || []) {
      countryCodes.add(country!.iso_2!.toLowerCase())
    }
  }

  logger.info(
    `[seed-tax] Found ${countryCodes.size} countries across ${regions.length} regions`
  )

  // Get all tax regions
  const allTaxRegions = await taxModuleService.listTaxRegions(
    {},
    { select: ["id", "country_code"] }
  )

  // Get all default tax rates directly from the tax_rate table
  const allDefaultRates = await taxModuleService.listTaxRates(
    { is_default: true } as any,
    { select: ["id", "rate", "code", "tax_region_id"] }
  )

  // Map for quick lookup: country_code → { regionId, rateId, rate }
  const rateByCountry = new Map<string, { regionId: string; rateId?: string; rate?: number }>()
  for (const tr of allTaxRegions) {
    const code = (tr as any).country_code?.toLowerCase()
    if (!code || !countryCodes.has(code)) continue
    rateByCountry.set(code, { regionId: tr.id })
  }
  for (const rate of allDefaultRates) {
    const taxRegion = allTaxRegions.find(
      (tr: any) => tr.id === (rate as any).tax_region_id
    )
    const code = (taxRegion as any)?.country_code?.toLowerCase()
    if (!code) continue
    rateByCountry.set(code, {
      regionId: (taxRegion as any).id,
      rateId: rate.id,
      rate: (rate as any).rate,
    })
  }

  const toCreate: { country_code: string; default_tax_rate?: any }[] = []

  for (const code of countryCodes) {
    const expectedRate = TAX_RATES[code] ?? DEFAULT_RATE
    const existing = rateByCountry.get(code)

    if (!existing) {
      // Tax region doesn't exist — create via workflow
      toCreate.push({
        country_code: code,
        default_tax_rate: {
          code: "VAT",
          name: expectedRate === 0 ? "VAT (Reverse Charge)" : "VAT",
          rate: expectedRate,
        },
      })
      continue
    }

    // Tax region exists — check its default rate
    const { regionId, rateId, rate: currentRate } = existing

    if (currentRate === expectedRate) {
      logger.info(`[seed-tax] ${code.toUpperCase()}: rate already ${expectedRate}% — skipping`)
      continue
    }

    // Rate is missing or wrong — upsert in-place
    const rateData: any = {
      tax_region_id: regionId,
      is_default: true,
      code: "VAT",
      name: expectedRate === 0 ? "VAT (Reverse Charge)" : "VAT",
      rate: expectedRate,
    }

    if (rateId) {
      rateData.id = rateId
      logger.info(
        `[seed-tax] ${code.toUpperCase()}: updating rate ${currentRate}% → ${expectedRate}%`
      )
    } else {
      logger.info(
        `[seed-tax] ${code.toUpperCase()}: creating default rate ${expectedRate}%`
      )
    }

    await taxModuleService.upsertTaxRates(rateData)
  }

  if (toCreate.length > 0) {
    logger.info(
      `[seed-tax] Creating tax regions for: ${toCreate.map((t) => `${t.country_code.toUpperCase()} (${t.default_tax_rate!.rate}%)`).join(", ")}`
    )

    await createTaxRegionsWorkflow(container).run({
      input: toCreate.map((item) => ({
        country_code: item.country_code,
        provider_id: "tp_system",
        default_tax_rate: item.default_tax_rate,
      })),
    })
  }

  logger.info("[seed-tax] Done! All tax regions have correct default rates.")

  for (const code of countryCodes) {
    const expectedRate = TAX_RATES[code] ?? DEFAULT_RATE
    logger.info(`[seed-tax]   ${code.toUpperCase()}: ${expectedRate}%${expectedRate === 0 ? " (reverse charge)" : ""}`)
  }
}
