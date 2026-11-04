import { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { reviewProduct } from "../utils/product-review"
import { revalidateStorefrontCache } from "../utils/revalidate-cache"
import { gatherSnapshot } from "./check-product"

export type SetStatusResult = {
  ok: boolean
  changed: boolean
  handle?: string
  from?: string
  to?: string
  message: string
  /** Why a product was not published: what the review found wrong with it. */
  problems: string[]
}

/**
 * Publishes a product or takes it back to draft.
 *
 *   npx medusa exec ./src/scripts/set-product-status.ts blue-cascade published
 *   npx medusa exec ./src/scripts/set-product-status.ts blue-cascade draft
 *
 * On the server, run the built file from `.medusa/server`:
 *   npx medusa exec ./src/scripts/set-product-status.js blue-cascade published
 *
 * A product is published only when the review of it (`check-product.ts`) finds
 * no problem: no pictures, no shipping class or sales channel and the like would
 * put a broken page on the storefront. Add `force` to publish regardless. Taking
 * a product back to draft is always allowed.
 */
export default async function setProductStatusScript({ container, args }: ExecArgs) {
  const words = args.map((arg) => arg.toLowerCase())
  const target = words.find((word) => word === "draft" || word === "published")
  const key = args.find((arg) => !["draft", "published", "force"].includes(arg.toLowerCase()))

  if (!key || !target) {
    console.log(
      "Usage: medusa exec ./src/scripts/set-product-status.ts <handle or id> draft|published [force]"
    )
    process.exitCode = 1
    return
  }

  const result = await setProductStatus(container, key, target, {
    force: words.includes("force"),
  })

  console.log(result.message)
  if (result.problems.length) {
    console.log(["", "Problems:", ...result.problems.map((p) => `  - ${p}`)].join("\n"))
  }
  console.log(`RESULT_JSON ${JSON.stringify(result)}`)

  if (!result.ok) {
    process.exitCode = 1
  }
}

export async function setProductStatus(
  container: MedusaContainer,
  key: string,
  target: "draft" | "published",
  { force = false }: { force?: boolean } = {}
): Promise<SetStatusResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { snapshot, message } = await gatherSnapshot(container, key)

  if (!snapshot) {
    return { ok: false, changed: false, message: message ?? `Not found: ${key}`, problems: [] }
  }

  const base = { handle: snapshot.handle, from: snapshot.status, to: target }

  if (snapshot.status === target) {
    return {
      ...base,
      ok: true,
      changed: false,
      message: `${snapshot.handle} is already ${target}; nothing was changed.`,
      problems: [],
    }
  }

  if (target === "published" && !force) {
    // Read as it would be once published, so "no pictures" counts as a problem.
    const { problems } = reviewProduct({ ...snapshot, status: "published" })
    if (problems.length) {
      return {
        ...base,
        ok: false,
        changed: false,
        message: `${snapshot.handle} was not published: it would go on the storefront with these problems. Fix them, or add "force" to publish anyway.`,
        problems,
      }
    }
  }

  await updateProductsWorkflow(container).run({
    input: {
      selector: { id: snapshot.id },
      update: {
        status:
          target === "published" ? ProductStatus.PUBLISHED : ProductStatus.DRAFT,
      },
    },
  })
  await revalidateStorefrontCache(["products", "variants", "categories"], logger)

  return {
    ...base,
    ok: true,
    changed: true,
    message: `${snapshot.handle} is now ${target} (it was ${snapshot.status}).`,
    problems: [],
  }
}
