import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createProductsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import {
  buildProductCopy,
  COPIED_PRODUCT_FIELDS,
  CopiedProduct,
  copyHandle,
} from "../utils/duplicate-product"
import { loadProductToDuplicateStep } from "./steps/load-product-to-duplicate"
import { copyProductExtrasStep } from "./steps/copy-product-extras"

export type DuplicateProductWorkflowInput = {
  product_id: string
  /** The copy's title. Its handle is made from it. */
  title: string
}

export type DuplicateProductWorkflowOutput = {
  id: string
  title: string
  handle: string
  status: string
}

/**
 * Makes a draft copy of a product under a new title: everything the original
 * says about itself, without its stock, SKU or barcodes and without its sale
 * prices (see `utils/duplicate-product.ts`). The original is not touched.
 */
export const duplicateProductWorkflow = createWorkflow(
  "duplicate-product",
  function (input: DuplicateProductWorkflowInput) {
    const loaded = loadProductToDuplicateStep({
      product_id: input.product_id,
      title: input.title,
    })

    const creation = transform({ input, loaded }, ({ input, loaded }) => ({
      products: [
        buildProductCopy(loaded.source, {
          title: input.title,
          handle: copyHandle(input.title, loaded.taken_handles),
        }),
      ],
    }))

    const created = createProductsWorkflow.runAsStep({ input: creation })

    const createdId = transform({ created }, ({ created }) => created[0].id)

    const { data: copies } = useQueryGraphStep({
      entity: "product",
      fields: COPIED_PRODUCT_FIELDS,
      filters: { id: createdId },
    }).config({ name: "load-copied-product" })

    const extrasInput = transform({ loaded, copies }, ({ loaded, copies }) => ({
      source: loaded.source,
      copied: copies[0] as unknown as CopiedProduct,
      translations: loaded.translations,
    }))

    copyProductExtrasStep(extrasInput)

    const result = transform({ copies }, ({ copies }) => ({
      id: copies[0].id,
      title: copies[0].title,
      handle: copies[0].handle,
      status: copies[0].status,
    }))

    return new WorkflowResponse<DuplicateProductWorkflowOutput>(result)
  }
)
