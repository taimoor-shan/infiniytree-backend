import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { generateResetPasswordTokenWorkflow } from "@medusajs/medusa/core-flows"

/** A test value for this app only */
export const PORTAL_PASSWORD = "portal-test-password-1"

type Api = {
  post: (path: string, body?: unknown, config?: unknown) => Promise<any>
}

/**
 * Gives a rep portal access, sets a first password with Medusa's own reset
 * flow, and signs in. Returns the rep's bearer token.
 */
export const portalLogin = async ({
  api,
  container,
  headers,
  repId,
  email,
}: {
  api: Api
  container: MedusaContainer
  headers: Record<string, string>
  repId: string
  email: string
}): Promise<string> => {
  await api.post(`/admin/sales-reps/${repId}/portal-access`, {}, { headers })

  const { http } = container.resolve(
    ContainerRegistrationKeys.CONFIG_MODULE
  ).projectConfig
  const { result: resetToken } = await generateResetPasswordTokenWorkflow(
    container
  ).run({
    input: {
      entityId: email,
      actorType: "sales_rep",
      provider: "emailpass",
      secret: http.jwtSecret,
      jwtOptions: http.jwtOptions,
    },
  })
  await api.post(
    "/auth/sales_rep/emailpass/update",
    { email, password: PORTAL_PASSWORD },
    { headers: { authorization: `Bearer ${resetToken}` } }
  )

  return (
    await api.post("/auth/sales_rep/emailpass", {
      email,
      password: PORTAL_PASSWORD,
    })
  ).data.token as string
}

export const jwtPayload = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())

/**
 * Records the events the plugin emits, in order. Subscribes once per process:
 * the event bus keeps its subscribers between tests, so call `clear()` before
 * each test instead of subscribing again.
 */
export const recordEvents = (container: MedusaContainer, names: string[]) => {
  const seen: { name: string; data: any }[] = []
  const bus = container.resolve(Modules.EVENT_BUS)
  for (const name of names) {
    bus.subscribe(name, async (event: any) => {
      seen.push({ name: event.name, data: event.data })
    })
  }

  return {
    seen,
    clear: () => {
      seen.length = 0
    },
  }
}
