import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

const PDF_BYTES = Buffer.from("%PDF-1.4 signed contract")

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>

    beforeEach(async () => {
      ;({ headers } = await createAdminHeaders(getContainer()))
    })

    const createRep = (body: Record<string, unknown>) =>
      api.post("/admin/sales-reps", body, { headers })

    describe("POST /admin/sales-reps", () => {
      it("creates an active rep with a normalized email", async () => {
        const { data } = await createRep({
          name: " Peter Nagy ",
          email: " Peter@Example.com ",
        })

        expect(data.sales_rep).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^srep_/),
            name: "Peter Nagy",
            email: "peter@example.com",
            is_active: true,
          })
        )
      })

      it("rejects a rep without a name", async () => {
        const error = await createRep({ email: "peter@example.com" }).catch(
          (e) => e.response
        )

        expect(error.status).toBe(400)
      })

      it("rejects an email that is already in use", async () => {
        await createRep({ name: "Peter Nagy", email: "peter@example.com" })

        const error = await createRep({
          name: "Peter Again",
          email: "PETER@example.com",
        }).catch((e) => e.response)

        expect(error.status).toBe(400)
        expect(error.data.message).toContain("peter@example.com")
      })
    })

    describe("GET /admin/sales-reps", () => {
      it("lists, searches and filters reps", async () => {
        await createRep({ name: "Peter Nagy", email: "peter@example.com" })
        const { data: anna } = await createRep({
          name: "Anna Kiss",
          email: "anna@example.com",
        })
        await api.post(
          `/admin/sales-reps/${anna.sales_rep.id}`,
          { is_active: false },
          { headers }
        )

        const all = await api.get("/admin/sales-reps", { headers })
        const search = await api.get("/admin/sales-reps?q=anna", { headers })
        const active = await api.get("/admin/sales-reps?is_active=true", {
          headers,
        })

        expect(all.data.count).toBe(2)
        expect(search.data.sales_reps.map((r) => r.name)).toEqual(["Anna Kiss"])
        expect(active.data.sales_reps.map((r) => r.name)).toEqual(["Peter Nagy"])
      })
    })

    describe("GET and POST /admin/sales-reps/:id", () => {
      it("returns and updates a rep", async () => {
        const { data } = await createRep({
          name: "Peter Nagy",
          email: "peter@example.com",
        })
        const id = data.sales_rep.id

        await api.post(
          `/admin/sales-reps/${id}`,
          { phone: "+36 30 123 4567", is_active: false },
          { headers }
        )
        const { data: fetched } = await api.get(`/admin/sales-reps/${id}`, {
          headers,
        })

        expect(fetched.sales_rep).toEqual(
          expect.objectContaining({
            id,
            phone: "+36 30 123 4567",
            is_active: false,
          })
        )
      })

      it("returns 404 for an unknown rep", async () => {
        const error = await api
          .get("/admin/sales-reps/srep_missing", { headers })
          .catch((e) => e.response)

        expect(error.status).toBe(404)
      })
    })

    describe("contracts", () => {
      let repId: string

      beforeEach(async () => {
        const { data } = await createRep({
          name: "Peter Nagy",
          email: "peter@example.com",
        })
        repId = data.sales_rep.id
      })

      const upload = (body: Record<string, unknown>) =>
        api.post(`/admin/sales-reps/${repId}/contracts`, body, { headers })

      it("stores a PDF and returns its metadata only", async () => {
        const { data } = await upload({
          file_name: "contract.pdf",
          mime_type: "application/pdf",
          content_base64: PDF_BYTES.toString("base64"),
        })
        const { data: list } = await api.get(
          `/admin/sales-reps/${repId}/contracts`,
          { headers }
        )

        expect(data.contract).toEqual(
          expect.objectContaining({
            file_name: "contract.pdf",
            mime_type: "application/pdf",
            size_bytes: PDF_BYTES.length,
          })
        )
        expect(data.contract).not.toHaveProperty("content_base64")
        expect(list.contracts).toHaveLength(1)
        expect(list.contracts[0]).not.toHaveProperty("content_base64")
      })

      it("downloads the original bytes as an attachment", async () => {
        const { data } = await upload({
          file_name: "contract.pdf",
          mime_type: "application/pdf",
          content_base64: PDF_BYTES.toString("base64"),
        })

        const response = await api.get(
          `/admin/sales-reps/${repId}/contracts/${data.contract.id}/download`,
          { headers, responseType: "arraybuffer" }
        )

        expect(Buffer.from(response.data).equals(PDF_BYTES)).toBe(true)
        expect(response.headers["content-type"]).toContain("application/pdf")
        expect(response.headers["content-disposition"]).toContain(
          'attachment; filename="contract.pdf"'
        )
      })

      it("does not serve a contract through another rep", async () => {
        const { data } = await upload({
          file_name: "contract.pdf",
          mime_type: "application/pdf",
          content_base64: PDF_BYTES.toString("base64"),
        })
        const { data: other } = await createRep({
          name: "Anna Kiss",
          email: "anna@example.com",
        })

        const error = await api
          .get(
            `/admin/sales-reps/${other.sales_rep.id}/contracts/${data.contract.id}/download`,
            { headers }
          )
          .catch((e) => e.response)

        expect(error.status).toBe(404)
      })

      it.each([
        ["a text file", { mime_type: "text/plain", content_base64: "aGVsbG8=" }],
        ["invalid base64", { mime_type: "application/pdf", content_base64: "%%%" }],
        ["an empty file", { mime_type: "application/pdf", content_base64: "" }],
        [
          "a file over 10 MB",
          {
            mime_type: "application/pdf",
            content_base64: Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64"),
          },
        ],
      ])("rejects %s", async (_, body) => {
        const error = await upload({ file_name: "contract.pdf", ...body }).catch(
          (e) => e.response
        )

        expect(error.status).toBe(400)
      })
    })
  },
})
