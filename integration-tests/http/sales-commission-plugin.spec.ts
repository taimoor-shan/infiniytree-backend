import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    describe("medusa-plugin-sales-commission", () => {
      it("serves the plugin's admin routes", async () => {
        const { headers } = await createAdminHeaders(getContainer())

        const response = await api
          .get("/admin/plugin", { headers })
          .catch((e) => e.response)

        expect(response.status).toEqual(200)
      })
    })
  },
})
