import fs from "fs/promises"
import os from "os"
import path from "path"
import { getMediaSettings, parseCleanupMode, resolveTrashDir } from "../media/config"
import {
  extractStaticReferences,
  isManagedUpload,
  selectOrphans,
} from "../media/references"
import {
  MediaPathError,
  deleteFromTrash,
  listFiles,
  listTrash,
  moveToTrash,
  purgeExpiredTrash,
  resolveInside,
  restoreFromTrash,
} from "../media/files"
import { classifyFiles, staticPath } from "../media/library"
import { RawQueryRunner, scanDatabaseReferences } from "../media/scan"
import { runMediaCleanup } from "../media/cleanup"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-11-22T12:00:00Z")
const OLD_MS = NOW.getTime() - 30 * DAY
const old = (name: string) => `${OLD_MS}-${name}`

describe("extractStaticReferences", () => {
  it("finds absolute and relative URLs in plain text, HTML and JSON", () => {
    const text = [
      `https://api.example.com/static/${old("a.jpg")}`,
      `<img src="/static/${old("b.png")}" alt="x">`,
      JSON.stringify({ video_url: `http://localhost:9000/static/${old("c.mp4")}` }),
    ].join(" ")
    const refs = extractStaticReferences(text)
    expect(refs.has(old("a.jpg"))).toBe(true)
    expect(refs.has(old("b.png"))).toBe(true)
    expect(refs.has(old("c.mp4"))).toBe(true)
  })

  it("decodes encoded names and drops punctuation after a URL", () => {
    const refs = extractStaticReferences(
      `background:url(/static/${old("my%20photo.jpg")}); see /static/${old("d.jpg")}.`
    )
    expect(refs.has(old("my photo.jpg"))).toBe(true)
    expect(refs.has(old("d.jpg"))).toBe(true)
  })

  it("stops at a query string, a fragment and escaped JSON quotes", () => {
    const refs = extractStaticReferences(
      `"/static/${old("e.jpg")}?v=2" {\\"src\\":\\"/static/${old("f.jpg")}\\"}`
    )
    expect(refs.has(old("e.jpg"))).toBe(true)
    expect(refs.has(old("f.jpg"))).toBe(true)
  })

  it("returns nothing for text without /static/", () => {
    expect(extractStaticReferences("no pictures here").size).toBe(0)
    expect(extractStaticReferences("").size).toBe(0)
  })
})

describe("selectOrphans", () => {
  const file = (name: string, mtime = new Date(OLD_MS), size = 10) => ({
    name,
    size,
    modified_at: mtime,
  })

  it("only picks unused uploads past the grace period", () => {
    const used = old("used.jpg")
    const files = [
      file(used),
      file(old("orphan.jpg")),
      file(`${NOW.getTime() - DAY}-new.jpg`, new Date(NOW.getTime() - DAY)),
      file("logo-full.png"),
      file(`private-${OLD_MS}-import.csv`),
      // Named old but written recently (copied back in): still in grace
      file(old("touched.jpg"), new Date(NOW.getTime() - DAY)),
    ]
    const picked = selectOrphans(files, (n) => n === used, NOW, 7).map((f) => f.name)
    expect(picked).toEqual([old("orphan.jpg")])
  })

  it("knows which files are uploads", () => {
    expect(isManagedUpload(old("x.jpg"))).toBe(true)
    expect(isManagedUpload(`folder/${old("x.jpg")}`)).toBe(true)
    expect(isManagedUpload("logo-full.png")).toBe(false)
    expect(isManagedUpload(`private-${OLD_MS}-x.csv`)).toBe(false)
  })
})

describe("config", () => {
  it("reports unless told otherwise", () => {
    expect(parseCleanupMode(undefined)).toBe("report")
    expect(parseCleanupMode("TRASH")).toBe("trash")
    expect(parseCleanupMode("off")).toBe("off")
    expect(parseCleanupMode("delete")).toBe("report")
  })

  it("puts the trash next to the upload folder", () => {
    expect(resolveTrashDir("/srv/medusa/uploads", {})).toBe("/srv/medusa/uploads-trash")
    expect(resolveTrashDir("/srv/u", { MEDIA_TRASH_DIR: "/x/t" })).toBe("/x/t")
    const s = getMediaSettings({ UPLOAD_DIR: "/srv/u", MEDIA_ORPHAN_MIN_AGE_DAYS: "3" })
    expect(s.minAgeDays).toBe(3)
    expect(s.trashRetentionDays).toBe(30)
    expect(s.mode).toBe("report")
  })
})

describe("resolveInside", () => {
  it("refuses anything that leaves the folder", () => {
    for (const bad of ["../etc/passwd", "/etc/passwd", "a/../../b", "", "a//b", "a\0b"]) {
      expect(() => resolveInside("/srv/u", bad)).toThrow(MediaPathError)
    }
    expect(resolveInside("/srv/u", "a/b.jpg")).toBe("/srv/u/a/b.jpg")
  })
})

describe("files and trash", () => {
  let root: string
  let uploadDir: string
  let trashDir: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "media-"))
    uploadDir = path.join(root, "uploads")
    trashDir = path.join(root, "uploads-trash")
    await fs.mkdir(path.join(uploadDir, "sub"), { recursive: true })
    await fs.writeFile(path.join(uploadDir, old("a.jpg")), "aaa")
    await fs.writeFile(path.join(uploadDir, "sub", old("b.jpg")), "bb")
    await fs.writeFile(path.join(uploadDir, ".hidden"), "x")
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it("lists files recursively without hidden ones", async () => {
    const names = (await listFiles(uploadDir)).map((f) => f.name).sort()
    expect(names).toEqual([old("a.jpg"), `sub/${old("b.jpg")}`].sort())
    expect(await listFiles(path.join(root, "missing"))).toEqual([])
  })

  it("moves to the trash, restores and never overwrites", async () => {
    const { moved, missing } = await moveToTrash(
      uploadDir,
      trashDir,
      [`sub/${old("b.jpg")}`, "nope.jpg"],
      NOW
    )
    expect(missing).toEqual(["nope.jpg"])
    expect(moved[0].id).toBe(`${NOW.getTime()}/sub/${old("b.jpg")}`)
    // The emptied sub folder is removed, the file is no longer served
    await expect(fs.stat(path.join(uploadDir, "sub"))).rejects.toThrow()

    const trash = await listTrash(trashDir)
    expect(trash).toHaveLength(1)
    expect(trash[0].name).toBe(`sub/${old("b.jpg")}`)
    expect(trash[0].size).toBe(2)

    // Someone uploaded a file with the same name meanwhile: not overwritten
    await fs.mkdir(path.join(uploadDir, "sub"))
    await fs.writeFile(path.join(uploadDir, "sub", old("b.jpg")), "new")
    let result = await restoreFromTrash(uploadDir, trashDir, [trash[0].id])
    expect(result.conflicts).toEqual([trash[0].id])
    await fs.unlink(path.join(uploadDir, "sub", old("b.jpg")))

    result = await restoreFromTrash(uploadDir, trashDir, [trash[0].id])
    expect(result.restored).toEqual([`sub/${old("b.jpg")}`])
    expect(await fs.readFile(path.join(uploadDir, "sub", old("b.jpg")), "utf8")).toBe("bb")
    expect(await listTrash(trashDir)).toEqual([])
  })

  it("deletes for good and purges only expired trash", async () => {
    await moveToTrash(uploadDir, trashDir, [old("a.jpg")], new Date(NOW.getTime() - 31 * DAY))
    await moveToTrash(uploadDir, trashDir, [`sub/${old("b.jpg")}`], new Date(NOW.getTime() - DAY))

    const purged = await purgeExpiredTrash(trashDir, 30, NOW)
    expect(purged.map((p) => p.name)).toEqual([old("a.jpg")])
    const left = await listTrash(trashDir)
    expect(left.map((t) => t.name)).toEqual([`sub/${old("b.jpg")}`])

    const { deleted } = await deleteFromTrash(trashDir, [left[0].id])
    expect(deleted).toEqual([left[0].id])
    expect(await listTrash(trashDir)).toEqual([])
    await expect(deleteFromTrash(trashDir, ["../x"])).rejects.toThrow(MediaPathError)
  })

  it("runs the cleanup in report and trash mode", async () => {
    await fs.writeFile(path.join(uploadDir, old("used.jpg")), "u")
    const db = fakeDb({
      product: { columns: ["thumbnail"], rows: [{ id: "prod_1", c0: `/static/${old("used.jpg")}` }] },
    })
    const settings = {
      uploadDir,
      trashDir,
      minAgeDays: 7,
      trashRetentionDays: 30,
      mode: "report" as const,
    }
    // File mtimes are "now" in real time, so pretend it is a year later.
    const later = new Date(Date.now() + 365 * DAY)

    const report = await runMediaCleanup(db, settings, { now: later })
    expect(report.unused_count).toBe(2)
    expect(report.trashed).toEqual([])
    expect((await listFiles(uploadDir)).length).toBe(3)

    const done = await runMediaCleanup(db, settings, { mode: "trash", now: later })
    expect(done.trashed.sort()).toEqual([old("a.jpg"), `sub/${old("b.jpg")}`].sort())
    expect((await listFiles(uploadDir)).map((f) => f.name)).toEqual([old("used.jpg")])

    const off = await runMediaCleanup(db, settings, { mode: "off", now: later })
    expect(off.unused_count).toBe(0)
  })
})

/** A stand-in for Knex that answers the two queries the scan makes. */
function fakeDb(
  tables: Record<string, { columns: string[]; rows: Record<string, unknown>[]; deletedAt?: boolean; productId?: boolean }>
): RawQueryRunner & { queries: string[] } {
  const queries: string[] = []
  return {
    queries,
    raw: async (sql: string) => {
      queries.push(sql)
      if (sql.includes("information_schema.columns")) {
        const rows: any[] = []
        for (const [table, t] of Object.entries(tables)) {
          rows.push({ table_name: table, column_name: "id", data_type: "text" })
          if (t.deletedAt) rows.push({ table_name: table, column_name: "deleted_at", data_type: "timestamp with time zone" })
          if (t.productId) rows.push({ table_name: table, column_name: "product_id", data_type: "text" })
          for (const c of t.columns) rows.push({ table_name: table, column_name: c, data_type: "jsonb" })
        }
        rows.push({ table_name: "number_only", column_name: "n", data_type: "integer" })
        return { rows }
      }
      const table = /FROM "([^"]+)"/.exec(sql)?.[1] as string
      return { rows: tables[table]?.rows ?? [] }
    },
  }
}

describe("scanDatabaseReferences", () => {
  it("collects usages from every text column and skips soft-deleted rows", async () => {
    const db = fakeDb({
      image: {
        columns: ["url"],
        productId: true,
        deletedAt: true,
        rows: [{ __id: "img_1", __product_id: "prod_1", c0: `https://x/static/${old("a.jpg")}` }],
      },
      page: {
        columns: ["featured_image", "content"],
        rows: [{ __id: "page_1", c0: null, c1: `<p><img src="/static/${old("b.jpg")}"></p>` }],
      },
    })
    const refs = await scanDatabaseReferences(db)
    expect(refs.get(old("a.jpg"))).toEqual([
      { table: "image", column: "url", id: "img_1", product_id: "prod_1" },
    ])
    expect(refs.get(old("b.jpg"))?.[0]).toMatchObject({ table: "page", column: "content" })

    const imageQuery = db.queries.find((q) => q.includes('FROM "image"')) as string
    expect(imageQuery).toContain(`"deleted_at" IS NULL`)
    expect(db.queries.some((q) => q.includes("number_only"))).toBe(false)
  })
})

describe("classifyFiles", () => {
  it("labels used, unused, recent and protected files", () => {
    const files = [
      { name: old("used.jpg"), size: 1, modified_at: new Date(OLD_MS) },
      { name: old("orphan.jpg"), size: 2, modified_at: new Date(OLD_MS) },
      { name: `${NOW.getTime()}-fresh.jpg`, size: 3, modified_at: NOW },
      { name: "logo-full.png", size: 4, modified_at: new Date(OLD_MS) },
    ]
    const refs = new Map([[old("used.jpg"), [{ table: "product", column: "thumbnail", id: "p", product_id: null }]]])
    const entries = classifyFiles(files, refs, NOW, 7)
    expect(entries.map((e) => e.status)).toEqual(["used", "unused", "recent", "protected"])
    expect(entries[0].usage_count).toBe(1)
    expect(staticPath("sub/my photo.jpg")).toBe("/static/sub/my%20photo.jpg")
  })
})

describe("admin display helpers", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const lib = require("../../admin/lib/media")

  it("formats sizes and names", () => {
    expect(lib.formatBytes(512)).toBe("512 B")
    expect(lib.formatBytes(1536)).toBe("1.5 KB")
    expect(lib.formatBytes(17 * 1024 * 1024)).toBe("17 MB")
    expect(lib.displayName(`sub/${old("Olive Tree.jpg")}`)).toBe("Olive Tree.jpg")
    expect(lib.isVideo("x.MP4")).toBe(true)
    expect(lib.isImage("x.avif")).toBe(true)
  })

  it("names and links the places a file is used", () => {
    const usage = (table: string, extra = {}) => ({ table, column: "c", id: "x_1", product_id: null, ...extra })
    expect(lib.describeUsage(usage("image", { product_id: "prod_1" }))).toEqual({
      label: "Product picture",
      href: "/app/products/prod_1",
    })
    expect(lib.describeUsage(usage("product")).href).toBe("/app/products/x_1")
    expect(lib.describeUsage(usage("store")).href).toBe("/app/settings/store")
    expect(lib.describeUsage(usage("order_line_item"))).toEqual({ label: "Order", href: null })
    expect(lib.describeUsage(usage("some_plugin_table")).label).toBe("some plugin table")
    expect(
      lib.summarizeUsages([usage("order_line_item"), usage("order_line_item"), usage("product")])
    ).toBe("Order (2), Product")
  })
})
