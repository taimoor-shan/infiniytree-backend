import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Creates an admin user and a secret API key for it, and returns the headers
 * that authenticate admin API requests as that user.
 */
export const createAdminHeaders = async (container: MedusaContainer) => {
  const userModule = container.resolve(Modules.USER)
  const apiKeyModule = container.resolve(Modules.API_KEY)

  const user = await userModule.createUsers({
    email: `admin-${Date.now()}@infinytree.test`,
  })
  const apiKey = await apiKeyModule.createApiKeys({
    title: "integration tests",
    type: "secret",
    created_by: user.id,
  })

  const token = Buffer.from(`${apiKey.token}:`).toString("base64")

  return {
    user,
    headers: { authorization: `Basic ${token}` },
  }
}
