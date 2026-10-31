import {
  ExecArgs,
  IFulfillmentModuleService,
  IProductModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createShippingProfilesWorkflow,
  updateProductCategoriesWorkflow,
} from "@medusajs/medusa/core-flows"
import { revalidateStorefrontCache } from "../utils/revalidate-cache"
import { blueCascade } from "./product-content/blue-cascade"
import { LEGACY_PALLET_PROFILE_NAME, PALLET_PROFILE } from "./shipping-classes"

export { PALLET_PROFILE }

/** The shop's category for one-of-a-kind pieces. */
export const ONE_OF_A_KIND = { name: "One of a kind", handle: "on-of-kind" }

/** The category was first saved with a typo; both spellings are the same one. */
const isOneOfAKind = (category: { name: string; handle: string }) =>
  category.handle === ONE_OF_A_KIND.handle ||
  ["one of a kind", "on of kind"].includes(category.name.trim().toLowerCase())

/**
 * Adds the Blue Cascade product: a one-of-a-kind arrangement that is out of
 * stock, has no price yet and takes "Notify me when available" signups.
 *
 *   npx medusa exec ./src/scripts/add-blue-cascade.ts          publish
 *   npx medusa exec ./src/scripts/add-blue-cascade.ts draft    as a draft
 *
 * On the server, run it from `.medusa/server` with the built file:
 *   npx medusa exec ./src/scripts/add-blue-cascade.js
 *
 * Safe to run twice: when the `blue-cascade` product exists it is left alone,
 * so what was edited in the admin is kept. The product has:
 *
 * - a "Planter" option (Blue, Gold, White) with one variant each, managed
 *   inventory and no stock, so every choice is unavailable until stock is added;
 * - no price at all, which the storefront shows as "Price on request";
 * - the "Pallet products" shipping class (created if missing);
 * - the "One of a kind" category (the existing one; its "On of kind" typo is
 *   corrected, its handle is not touched).
 *
 * Photos and the video are added in the admin. Delivery rates by destination
 * are set up with `setup-shipping.ts` and edited under Shipping rates.
 */
export default async function addBlueCascadeScript({
  container,
  args,
}: ExecArgs) {
  const status = args.includes("draft")
    ? ProductStatus.DRAFT
    : ProductStatus.PUBLISHED

  await addBlueCascade(container, { status })
}

export async function addBlueCascade(
  container: MedusaContainer,
  { status = ProductStatus.PUBLISHED }: { status?: ProductStatus } = {}
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = container.resolve(Modules.PRODUCT)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)

  const [existing] = await productService.listProducts(
    { handle: blueCascade.handle },
    { select: ["id"], take: 1 }
  )

  if (existing) {
    logger.info(
      `Blue Cascade already exists (${existing.id}); it was left as it is.`
    )
    return { created: false as const, productId: existing.id }
  }

  const salesChannels = await salesChannelService.listSalesChannels()
  const salesChannel =
    salesChannels.find((channel) => channel.name === "Default Sales Channel") ??
    salesChannels[0]

  if (!salesChannel) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "There is no sales channel to sell Blue Cascade in."
    )
  }

  const shippingProfileId = await findOrCreatePalletProfile(
    container,
    fulfillmentService
  )
  const categoryId = await findOrCreateCategory(container, productService)

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: blueCascade.title,
          handle: blueCascade.handle,
          subtitle: blueCascade.subtitle,
          description: blueCascade.description,
          status,
          shipping_profile_id: shippingProfileId,
          category_ids: [categoryId],
          sales_channels: [{ id: salesChannel.id }],
          options: [
            {
              title: blueCascade.planterOption,
              values: blueCascade.planters,
            },
          ],
          // Stock is tracked and there is none; no prices are given, so the
          // product reads "Price on request" until the owner sets them.
          variants: blueCascade.planters.map((planter, rank) => ({
            title: planter,
            options: { [blueCascade.planterOption]: planter },
            manage_inventory: true,
            allow_backorder: false,
            variant_rank: rank,
            prices: [],
          })),
          // Structured values are JSON text, as the admin's metadata editor
          // stores them; `key_features` is a list of texts by language.
          metadata: {
            short_description: blueCascade.shortDescription,
            key_features: JSON.stringify(
              blueCascade.keyFeatures.map((en) => ({ en }))
            ),
            approx_dimensions: JSON.stringify(blueCascade.approxDimensions),
            seo_title: blueCascade.seoTitle,
            seo_description: blueCascade.seoDescription,
          },
        },
      ],
    },
  })

  const product = result[0]

  await revalidateStorefrontCache(["products", "variants", "categories"], logger)

  logger.info(
    `Blue Cascade added (${product.id}, ${status}): planters ${blueCascade.planters.join(
      ", "
    )} out of stock, no price, shipping class "${PALLET_PROFILE.name}".`
  )

  return { created: true as const, productId: product.id }
}

async function findOrCreatePalletProfile(
  container: MedusaContainer,
  fulfillmentService: IFulfillmentModuleService
): Promise<string> {
  // Found by type, so renaming the class in the admin does not make a second
  // one; the name it first had is the fallback.
  const [byType] = await fulfillmentService.listShippingProfiles({
    type: PALLET_PROFILE.type,
  })
  const [existing] = byType
    ? [byType]
    : await fulfillmentService.listShippingProfiles({
        name: [PALLET_PROFILE.name, LEGACY_PALLET_PROFILE_NAME],
      })

  if (existing) {
    return existing.id
  }

  const { result } = await createShippingProfilesWorkflow(container).run({
    input: { data: [PALLET_PROFILE] },
  })

  return result[0].id
}

async function findOrCreateCategory(
  container: MedusaContainer,
  productService: IProductModuleService
): Promise<string> {
  const categories = await productService.listProductCategories(
    {},
    { select: ["id", "name", "handle"] }
  )
  const existing = categories.find(isOneOfAKind)

  if (existing) {
    if (existing.name !== ONE_OF_A_KIND.name) {
      await updateProductCategoriesWorkflow(container).run({
        input: {
          selector: { id: [existing.id] },
          update: { name: ONE_OF_A_KIND.name },
        },
      })
    }
    return existing.id
  }

  const { result } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: [{ name: ONE_OF_A_KIND.name, is_active: true }],
    },
  })

  return result[0].id
}
