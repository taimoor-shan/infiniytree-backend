import { extractStaticReferences } from "./references"

/**
 * Finds every `/static/<file>` reference in the database.
 *
 * Instead of a list of "places where a picture can be" (product images,
 * variant thumbnails, metadata, pages, posts, store metadata, translations,
 * order lines, …), which would silently miss the next field someone adds, it
 * reads every text and JSON column of every table and keeps the rows that
 * contain `/static/`. The shop's database is small, and Postgres does the
 * filtering, so this takes well under a second; it runs when the Media
 * library opens and once a night.
 *
 * Soft-deleted rows (`deleted_at` set) do not count: a deleted product's
 * pictures are free to go, while an order that showed them keeps them through
 * its own line items, which are never soft-deleted with the product.
 */

export type MediaUsage = {
  table: string
  column: string
  id: string | null
  /** The product a picture row belongs to (`product_id`), for a link in the admin. */
  product_id: string | null
}

export type ReferenceMap = Map<string, MediaUsage[]>

/** Minimal Knex surface used here, so tests can pass a stand-in. */
export type RawQueryRunner = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: any[] }>
}

const TEXT_TYPES = ["text", "character varying", "character", "json", "jsonb", "ARRAY"]

/** Tables that cannot hold a picture URL and are only noise for the scan. */
const SKIPPED_TABLES = new Set(["mikro_orm_migrations", "script_migrations"])

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

type TableColumns = {
  columns: string[]
  hasId: boolean
  hasDeletedAt: boolean
  hasProductId: boolean
}

async function listTextColumns(db: RawQueryRunner): Promise<Map<string, TableColumns>> {
  const { rows } = await db.raw(
    `SELECT c.table_name, c.column_name, c.data_type
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = current_schema()
        AND t.table_type = 'BASE TABLE'`
  )

  const tables = new Map<string, TableColumns>()
  for (const row of rows) {
    const table = row.table_name as string
    if (SKIPPED_TABLES.has(table)) continue
    const entry =
      tables.get(table) ||
      { columns: [], hasId: false, hasDeletedAt: false, hasProductId: false }
    if (row.column_name === "id") entry.hasId = true
    if (row.column_name === "deleted_at") entry.hasDeletedAt = true
    if (row.column_name === "product_id") entry.hasProductId = true
    // Ids and foreign keys (`id`, `product_id`) cannot hold a URL
    const isKey = row.column_name === "id" || /_id$/.test(row.column_name)
    if (TEXT_TYPES.includes(row.data_type) && !isKey) {
      entry.columns.push(row.column_name)
    }
    tables.set(table, entry)
  }
  for (const [table, entry] of tables) {
    if (!entry.columns.length) tables.delete(table)
  }
  return tables
}

const MAX_USAGES_PER_FILE = 50

function addUsage(map: ReferenceMap, name: string, usage: MediaUsage) {
  const list = map.get(name)
  if (!list) {
    map.set(name, [usage])
  } else if (list.length < MAX_USAGES_PER_FILE) {
    list.push(usage)
  }
}

export async function scanDatabaseReferences(db: RawQueryRunner): Promise<ReferenceMap> {
  const references: ReferenceMap = new Map()
  const tables = await listTextColumns(db)

  for (const [table, info] of tables) {
    const select: string[] = []
    if (info.hasId) select.push(`${quoteIdent("id")}::text AS "__id"`)
    if (info.hasProductId) select.push(`${quoteIdent("product_id")}::text AS "__product_id"`)
    info.columns.forEach((column, i) => {
      select.push(`${quoteIdent(column)}::text AS "c${i}"`)
    })
    const matches = info.columns
      .map((column) => `${quoteIdent(column)}::text LIKE '%/static/%'`)
      .join(" OR ")
    const notDeleted = info.hasDeletedAt ? ` AND ${quoteIdent("deleted_at")} IS NULL` : ""

    const { rows } = await db.raw(
      `SELECT ${select.join(", ")} FROM ${quoteIdent(table)} WHERE (${matches})${notDeleted}`
    )

    for (const row of rows) {
      info.columns.forEach((column, i) => {
        const value = row[`c${i}`]
        if (typeof value !== "string") return
        for (const name of extractStaticReferences(value)) {
          addUsage(references, name, {
            table,
            column,
            id: row.__id ?? null,
            product_id: row.__product_id ?? null,
          })
        }
      })
    }
  }
  return references
}
