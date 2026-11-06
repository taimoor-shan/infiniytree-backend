import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * The forms an email may be stored in: as typed (without the spaces around it)
 * and lowercased, the form Medusa's `validateEmail` saves.
 */
export const emailVariants = (email?: string | null): string[] => {
  const trimmed = (email ?? "").trim()
  return trimmed ? [...new Set([trimmed, trimmed.toLowerCase()])] : []
}

/**
 * The id of the account that has this email: a customer who can sign in.
 * Guest records (what Medusa makes for every email typed at checkout) don't
 * count.
 */
export const findAccountId = async (
  container: MedusaContainer,
  email?: string | null
): Promise<string | null> => {
  const emails = emailVariants(email)
  // An empty list would filter nothing and match every account
  if (!emails.length) {
    return null
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id"],
    filters: { email: emails, has_account: true },
    pagination: { take: 1 },
  })

  return data[0]?.id ?? null
}
