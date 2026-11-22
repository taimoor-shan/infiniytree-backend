import fs from "fs"
import os from "os"
import path from "path"

// medusa-config.ts reads UPLOAD_DIR when the app boots, so set it first: the
// local file provider and the Media library then share a throwaway folder.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "media-it-"))
const UPLOAD_DIR = path.join(ROOT, "uploads")
fs.mkdirSync(UPLOAD_DIR, { recursive: true })
process.env.UPLOAD_DIR = UPLOAD_DIR
process.env.MEDIA_CLEANUP_MODE = "report"

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import mediaCleanupJob from "../../src/jobs/media-cleanup"

jest.setTimeout(120 * 1000)

const DAY = 24 * 60 * 60 * 1000
const OLD = Date.now() - 30 * DAY
const name = (n: string) => `${OLD}-${n}`

const GALLERY = name("gallery.jpg")
const VIDEO = name("video.mp4")
const BANNER = name("banner.mp4")
const ORPHAN = name("orphan.jpg")
const FRESH = `${Date.now()}-fresh.jpg`
const LOGO = "logo-full.png"

function put(file: string, mtime = new Date(OLD)) {
  const full = path.join(UPLOAD_DIR, file)
  fs.writeFileSync(full, file)
  fs.utimesSync(full, mtime, mtime)
}

function inUploads(file: string) {
  return fs.existsSync(path.join(UPLOAD_DIR, file))
}

/**
 * The Media library reads the real database: a file is "used" when any row
 * points at its /static/ address. These tests save the addresses the way the
 * admin does (product gallery, product metadata, store metadata) and check
 * what the library, the trash and the nightly job make of them.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let productId: string

    afterAll(() => {
      fs.rmSync(ROOT, { recursive: true, force: true })
    })

    beforeEach(async () => {
      fs.rmSync(UPLOAD_DIR, { recursive: true, force: true })
      fs.rmSync(`${UPLOAD_DIR}-trash`, { recursive: true, force: true })
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
      for (const f of [GALLERY, VIDEO, BANNER, ORPHAN, LOGO]) put(f)
      put(FRESH, new Date())

      const container = getContainer()
      headers = (await createAdminHeaders(container)).headers

      const {
        result: [product],
      } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Olive tree",
              status: ProductStatus.PUBLISHED,
              images: [{ url: `http://localhost:9000/static/${GALLERY}` }],
              metadata: { video_url: `/static/${VIDEO}` },
              options: [{ title: "Size", values: ["M"] }],
              variants: [{ title: "M", options: { Size: "M" }, manage_inventory: false, prices: [] }],
            },
          ],
        },
      })
      productId = product.id

      const [store] = await container.resolve(Modules.STORE).listStores()
      await api.post(
        `/admin/stores/${store.id}`,
        { metadata: { home_banner_video: `http://localhost:9000/static/${BANNER}` } },
        { headers }
      )
    })

    const statusOf = async () => {
      const { data } = await api.get("/admin/media?refresh=true&limit=200", { headers })
      return Object.fromEntries(data.files.map((f: any) => [f.name, f.status]))
    }

    it("tells used, unused, recent and protected files apart", async () => {
      const { data } = await api.get("/admin/media?refresh=true", { headers })
      const byName = Object.fromEntries(data.files.map((f: any) => [f.name, f]))

      expect(byName[GALLERY].status).toBe("used")
      expect(byName[GALLERY].usages[0]).toMatchObject({ table: "image", product_id: productId })
      expect(byName[VIDEO].usages[0]).toMatchObject({ table: "product", column: "metadata" })
      expect(byName[BANNER].usages[0]).toMatchObject({ table: "store", column: "metadata" })
      expect(byName[ORPHAN].status).toBe("unused")
      expect(byName[FRESH].status).toBe("recent")
      expect(byName[LOGO].status).toBe("protected")

      expect(data.stats).toMatchObject({ file_count: 6, unused_count: 1, trash_count: 0 })
      expect(data.settings.mode).toBe("report")

      const unused = await api.get("/admin/media?status=unused", { headers })
      expect(unused.data.files.map((f: any) => f.name)).toEqual([ORPHAN])
    })

    it("names uploads the way the cleanup expects", async () => {
      const form = new FormData()
      form.append("files", new Blob(["hello"], { type: "image/jpeg" }), "upload test.jpg")
      const { data } = await api.post("/admin/uploads", form, { headers })
      const url: string = data.files[0].url
      const fileName = decodeURIComponent(url.split("/static/")[1])
      expect(fileName).toMatch(/^\d{13}-upload test\.jpg$/)
      expect(inUploads(fileName)).toBe(true)
      expect((await statusOf())[fileName]).toBe("recent")
    })

    it("moves only unused files to the trash and restores them", async () => {
      const { data } = await api.post(
        "/admin/media/trash",
        { names: [ORPHAN, GALLERY, LOGO, "missing.jpg"] },
        { headers }
      )
      expect(data.moved.map((m: any) => m.name)).toEqual([ORPHAN])
      expect(data.refused).toEqual(
        expect.arrayContaining([
          { name: GALLERY, reason: "in_use" },
          { name: LOGO, reason: "protected" },
          { name: "missing.jpg", reason: "not_found" },
        ])
      )
      expect(inUploads(ORPHAN)).toBe(false)
      expect(inUploads(GALLERY)).toBe(true)

      const trash = await api.get("/admin/media/trash", { headers })
      expect(trash.data.items).toHaveLength(1)
      expect(trash.data.retention_days).toBe(30)
      const id = trash.data.items[0].id

      const restored = await api.post("/admin/media/trash/restore", { ids: [id] }, { headers })
      expect(restored.data.restored).toEqual([ORPHAN])
      expect(inUploads(ORPHAN)).toBe(true)

      await api.post("/admin/media/trash", { names: [ORPHAN] }, { headers })
      const again = await api.get("/admin/media/trash", { headers })
      const deleted = await api.post(
        "/admin/media/trash/delete",
        { ids: [again.data.items[0].id] },
        { headers }
      )
      expect(deleted.data.deleted).toHaveLength(1)
      expect((await api.get("/admin/media/trash", { headers })).data.items).toEqual([])
    })

    it("refuses paths outside the upload folder", async () => {
      const res = await api
        .post("/admin/media/trash/delete", { ids: ["1/../../etc/passwd"] }, { headers })
        .catch((e) => e.response)
      expect(res.status).toBe(400)
    })

    it("frees a picture once it is removed from the product or the product is deleted", async () => {
      // Medusa made the first gallery picture the thumbnail: while the
      // thumbnail still shows it, the file is in use.
      await api.post(`/admin/products/${productId}`, { images: [] }, { headers })
      let status = await statusOf()
      expect(status[GALLERY]).toBe("used")

      await api.post(`/admin/products/${productId}`, { thumbnail: null }, { headers })
      status = await statusOf()
      expect(status[GALLERY]).toBe("unused")
      expect(status[VIDEO]).toBe("used")

      await api.delete(`/admin/products/${productId}`, { headers })
      status = await statusOf()
      expect(status[VIDEO]).toBe("unused")
      expect(status[BANNER]).toBe("used")
    })

    it("the nightly job only reports by default, and Clean up now moves", async () => {
      await mediaCleanupJob(getContainer())
      expect(inUploads(ORPHAN)).toBe(true)

      const { data } = await api.post("/admin/media/cleanup", {}, { headers })
      expect(data.trashed).toEqual([ORPHAN])
      expect(inUploads(ORPHAN)).toBe(false)
      for (const f of [GALLERY, VIDEO, BANNER, FRESH, LOGO]) expect(inUploads(f)).toBe(true)
    })
  },
})
