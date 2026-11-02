import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { ITranslationModuleService } from "@medusajs/types"
import {
  handleBase,
  SOURCE_PRODUCT_FIELDS,
  SourceProduct,
  TranslationRow,
} from "../../utils/duplicate-product"

export type LoadProductToDuplicateInput = {
  product_id: string
  title: string
}

export type LoadedProductToDuplicate = {
  source: SourceProduct
  /** Handles that begin like the copy's, so it can be given one that is free. */
  taken_handles: string[]
  /** What the original says in other languages, for the copy to say too. */
  translations: TranslationRow[]
}

/**
 * Reads the product to copy, in one go: the product with everything a copy
 * keeps, the handles it must not repeat, and its translations. Only reads.
 */
export const loadProductToDuplicateStep = createStep(
  "load-product-to-duplicate",
  async (input: LoadProductToDuplicateInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [source],
    } = await query.graph({
      entity: "product",
      fields: SOURCE_PRODUCT_FIELDS,
      filters: { id: input.product_id },
    })

    if (!source) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product with id: ${input.product_id} was not found`
      )
    }

    const { data: sameStart } = await query.graph({
      entity: "product",
      fields: ["handle"],
      filters: { handle: { $like: `${handleBase(input.title)}%` } },
    })

    // A translation belongs to the product, one of its options or choices, or
    // one of its variants.
    const translatedIds = [
      source.id,
      ...(source.options ?? []).flatMap((option: any) => [
        option.id,
        ...(option.values ?? []).map((value: any) => value.id),
      ]),
      ...(source.variants ?? []).map((variant: any) => variant.id),
    ]
    const translationService: ITranslationModuleService = container.resolve(
      Modules.TRANSLATION
    )
    const rows = await translationService.listTranslations(
      { reference_id: translatedIds },
      { take: null }
    )

    return new StepResponse<LoadedProductToDuplicate>({
      source: source as SourceProduct,
      taken_handles: sameStart.map((product: any) => product.handle),
      translations: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        reference_id: row.reference_id,
        locale_code: row.locale_code,
        translations: row.translations as Record<string, unknown> | null,
      })),
    })
  }
)
