import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import {
  CreateTranslationDTO,
  IProductModuleService,
  ITranslationModuleService,
} from "@medusajs/types"
import {
  CopiedProduct,
  planCopyExtras,
  SourceProduct,
  TranslationRow,
} from "../../utils/duplicate-product"

export type CopyProductExtrasInput = {
  source: SourceProduct
  copied: CopiedProduct
  translations: TranslationRow[]
}

type CopyProductExtrasUndo = {
  translation_ids: string[]
  variant_images: { variant_id: string; image_id: string }[]
}

/**
 * Gives the new product what the create input cannot carry: the thumbnail and
 * pictures of each variant, and the original's translations. Which record of
 * the copy answers to which of the original is worked out in `planCopyExtras`.
 *
 * It keeps count of what it has saved, and takes that back if it stops half
 * way or if a later step fails.
 */
export const copyProductExtrasStep = createStep(
  "copy-product-extras",
  async (input: CopyProductExtrasInput, { container }) => {
    const productService: IProductModuleService = container.resolve(
      Modules.PRODUCT
    )
    const translationService: ITranslationModuleService = container.resolve(
      Modules.TRANSLATION
    )

    const extras = planCopyExtras(input.source, input.copied, input.translations)
    const done: CopyProductExtrasUndo = { translation_ids: [], variant_images: [] }

    try {
      for (const { variant_id, thumbnail } of extras.variantThumbnails) {
        await productService.updateProductVariants(variant_id, { thumbnail })
      }

      if (extras.variantImages.length) {
        await productService.addImageToVariant(extras.variantImages)
        done.variant_images = extras.variantImages
      }

      if (extras.translations.length) {
        const created = await translationService.createTranslations(
          extras.translations as CreateTranslationDTO[]
        )
        done.translation_ids = created.map((translation) => translation.id)
      }
    } catch (error) {
      await undoCopyProductExtras(done, container)
      throw error
    }

    return new StepResponse(
      {
        variant_thumbnails: extras.variantThumbnails.length,
        variant_images: extras.variantImages.length,
        translations: extras.translations.length,
      },
      done
    )
  },
  async (done, { container }) => {
    if (done) {
      await undoCopyProductExtras(done, container)
    }
  }
)

/**
 * Takes back the pictures and translations of the copy. Its variant thumbnails
 * go with the variants, which are deleted along with the product.
 */
async function undoCopyProductExtras(
  done: CopyProductExtrasUndo,
  container: { resolve: (key: string) => any }
) {
  if (done.variant_images.length) {
    const productService: IProductModuleService = container.resolve(
      Modules.PRODUCT
    )
    await productService.removeImageFromVariant(done.variant_images)
  }

  if (done.translation_ids.length) {
    const translationService: ITranslationModuleService = container.resolve(
      Modules.TRANSLATION
    )
    await translationService.deleteTranslations(done.translation_ids)
  }
}
