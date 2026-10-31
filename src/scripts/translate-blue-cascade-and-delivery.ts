import { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  batchTranslationsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { ITranslationModuleService } from "@medusajs/types"
import {
  addLanguages,
  addLanguagesToList,
  Texts,
} from "../utils/localized-metadata"
import { revalidateStorefrontCache } from "../utils/revalidate-cache"
import { ONE_OF_A_KIND } from "./add-blue-cascade"
import { blueCascade } from "./product-content/blue-cascade"
import { DELIVERY_OPTIONS, TARIFF_PROVIDER_ID } from "./shipping-classes"

/**
 * The locale German is saved under. The store offers this one German locale,
 * and the storefront asks Medusa for it in every German market (`matchLocale`
 * there swaps `de-AT` for it), so one translation serves Austria and Germany.
 */
export const GERMAN = "de-DE"

export type TranslateResult = {
  /** Translations saved for the first time. */
  created: string[]
  /** Translations that lacked some fields and were given them. */
  updated: string[]
  /** Translations that already had every field, left as they are. */
  kept: string[]
  /** Metadata fields of Blue Cascade that were given their other languages. */
  metadata_added: string[]
  /** What was looked for and is not there. */
  missing: string[]
}

type Wanted = {
  /** What it is, for the log. */
  label: string
  /** The kind of record, as the translation module names it. */
  reference: string
  reference_id: string
  texts: Record<string, string>
}

const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== ""

/**
 * Translates what the shop added last: the Blue Cascade product and the
 * pallet and carton delivery options.
 *
 *   npx medusa exec ./src/scripts/translate-blue-cascade-and-delivery.ts
 *
 * On the server, run it from `.medusa/server` with the built file:
 *   npx medusa exec ./src/scripts/translate-blue-cascade-and-delivery.js
 *
 * Run it after `add-blue-cascade.ts` and `setup-shipping.ts`. It adds only what
 * is missing, so it is safe to run twice and never replaces a translation
 * that was written or edited in the admin. It finds everything by name, not by
 * id, so it works on any copy of the shop. It saves:
 *
 * - German for the product (name, badge, description), its "Planter" option,
 *   the three planters, their variants and the "One of a kind" category;
 * - German for each "Pallet delivery" and "Carton delivery" option and for
 *   the type of each (the name and the sentence under it);
 * - the product's other languages in its metadata (short description, key
 *   features, search title and description): German for both markets and
 *   Hungarian, next to the English that is there. A text whose English was
 *   edited since is left alone.
 */
export default async function translateBlueCascadeAndDeliveryScript({
  container,
}: ExecArgs) {
  await translateBlueCascadeAndDelivery(container)
}

export async function translateBlueCascadeAndDelivery(
  container: MedusaContainer
): Promise<TranslateResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const result: TranslateResult = {
    created: [],
    updated: [],
    kept: [],
    metadata_added: [],
    missing: [],
  }
  const wanted: Wanted[] = []

  // 1. The product, its option, planters, variants and category
  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "metadata",
      "options.id",
      "options.title",
      "options.values.id",
      "options.values.value",
      "variants.id",
      "variants.title",
      "categories.id",
      "categories.name",
    ],
    filters: { handle: blueCascade.handle },
  })

  if (!product) {
    result.missing.push(`the ${blueCascade.handle} product`)
  } else {
    const german = blueCascade.german

    wanted.push({
      label: "Blue Cascade",
      reference: "product",
      reference_id: product.id,
      texts: {
        title: german.title,
        subtitle: german.subtitle,
        description: german.description,
      },
    })

    for (const option of product.options ?? []) {
      if (option?.title !== blueCascade.planterOption) {
        continue
      }

      wanted.push({
        label: `option ${option.title}`,
        reference: "product_option",
        reference_id: option.id,
        texts: { title: german.planterOption },
      })

      for (const value of option.values ?? []) {
        const text = value ? german.planters[value.value] : undefined
        if (value && text) {
          wanted.push({
            label: `${option.title} ${value.value}`,
            reference: "product_option_value",
            reference_id: value.id,
            texts: { value: text },
          })
        }
      }
    }

    for (const variant of product.variants ?? []) {
      const text = variant ? german.planters[variant.title] : undefined
      if (variant && text) {
        wanted.push({
          label: `variant ${variant.title}`,
          reference: "product_variant",
          reference_id: variant.id,
          texts: { title: text },
        })
      }
    }

    for (const category of product.categories ?? []) {
      if (category?.name === ONE_OF_A_KIND.name) {
        wanted.push({
          label: `category ${category.name}`,
          reference: "product_category",
          reference_id: category.id,
          texts: { name: german.category },
        })
      }
    }
  }

  // 2. The delivery options and their types (each option has a type of its own)
  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "type.id", "type.code"],
    filters: { provider_id: TARIFF_PROVIDER_ID },
  })

  for (const delivery of DELIVERY_OPTIONS) {
    const options = shippingOptions.filter(
      (option) => option.type?.code === delivery.code
    )

    if (!options.length) {
      result.missing.push(`the ${delivery.name} options`)
    }

    for (const option of options) {
      wanted.push({
        label: `${delivery.name} ${option.id}`,
        reference: "shipping_option",
        reference_id: option.id,
        texts: { name: delivery.german.name },
      })
      if (option.type?.id) {
        wanted.push({
          label: `${delivery.name} type ${option.type.id}`,
          reference: "shipping_option_type",
          reference_id: option.type.id,
          texts: {
            label: delivery.german.name,
            description: delivery.german.description,
          },
        })
      }
    }
  }

  await saveTranslations(container, wanted, result)

  // 3. The product's metadata, which holds one text per language
  if (product) {
    const metadata = (product.metadata ?? {}) as Record<string, unknown>
    const next = { ...metadata }
    const languages = (
      en: string,
      german: string,
      hungarian: string
    ): Texts => ({
      en,
      "de-AT": german,
      "de-DE": german,
      "hu-HU": hungarian,
    })
    const { german, hungarian } = blueCascade

    const texts: Record<string, Texts> = {
      short_description: languages(
        blueCascade.shortDescription,
        german.shortDescription,
        hungarian.shortDescription
      ),
      seo_title: languages(
        blueCascade.seoTitle,
        german.seoTitle,
        hungarian.seoTitle
      ),
      seo_description: languages(
        blueCascade.seoDescription,
        german.seoDescription,
        hungarian.seoDescription
      ),
    }
    for (const [key, value] of Object.entries(texts)) {
      const added = addLanguages(metadata[key], value)
      if (added) {
        next[key] = added
        result.metadata_added.push(key)
      }
    }

    const features = addLanguagesToList(
      metadata.key_features,
      blueCascade.keyFeatures.map((en, index) =>
        languages(en, german.keyFeatures[index], hungarian.keyFeatures[index])
      )
    )
    if (features) {
      next.key_features = features
      result.metadata_added.push("key_features")
    }

    if (result.metadata_added.length) {
      await updateProductsWorkflow(container).run({
        input: { selector: { id: product.id }, update: { metadata: next } },
      })
    }
  }

  if (
    result.created.length ||
    result.updated.length ||
    result.metadata_added.length
  ) {
    await revalidateStorefrontCache(
      ["products", "variants", "categories"],
      logger
    )
  }

  logSummary(logger, result)
  return result
}

/**
 * Saves German for each record: creates the translation, or adds the fields an
 * existing one lacks. A field that has text is never replaced.
 */
async function saveTranslations(
  container: MedusaContainer,
  wanted: Wanted[],
  result: TranslateResult
) {
  if (!wanted.length) {
    return
  }

  const translations: ITranslationModuleService = container.resolve(
    Modules.TRANSLATION
  )
  const existing = await translations.listTranslations(
    {
      reference_id: wanted.map((item) => item.reference_id),
      locale_code: GERMAN,
    },
    { take: null }
  )

  const create: {
    reference: string
    reference_id: string
    locale_code: string
    translations: Record<string, string>
  }[] = []
  const update: { id: string; translations: Record<string, unknown> }[] = []

  for (const item of wanted) {
    const current = existing.find(
      (translation) =>
        translation.reference === item.reference &&
        translation.reference_id === item.reference_id
    )

    if (!current) {
      create.push({
        reference: item.reference,
        reference_id: item.reference_id,
        locale_code: GERMAN,
        translations: item.texts,
      })
      result.created.push(item.label)
      continue
    }

    const lacking = Object.entries(item.texts).filter(
      ([field]) => !hasText(current.translations?.[field])
    )
    if (!lacking.length) {
      result.kept.push(item.label)
      continue
    }

    update.push({
      id: current.id,
      translations: { ...current.translations, ...Object.fromEntries(lacking) },
    })
    result.updated.push(item.label)
  }

  if (create.length || update.length) {
    await batchTranslationsWorkflow(container).run({
      input: { create, update, delete: [] },
    })
  }
}

function logSummary(
  logger: { info: (message: string) => void; warn: (message: string) => void },
  result: TranslateResult
) {
  const list = (items: string[]) => (items.length ? items.join(", ") : "none")

  logger.info(
    `German translations: saved ${list(result.created)}; completed ${list(
      result.updated
    )}; already complete ${list(result.kept)}.`
  )
  logger.info(
    `Blue Cascade metadata given its other languages: ${list(
      result.metadata_added
    )}.`
  )
  if (result.missing.length) {
    logger.warn(
      `Not found, so not translated (run add-blue-cascade.ts and setup-shipping.ts first): ${list(
        result.missing
      )}.`
    )
  }
}
