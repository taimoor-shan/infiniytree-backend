/**
 * Display helpers for the Media library screen (pure, unit tested).
 */

export type MediaStatus = "used" | "unused" | "recent" | "protected"

export type MediaUsage = {
  table: string
  column: string
  id: string | null
  product_id: string | null
}

export type MediaFile = {
  name: string
  path: string
  url: string
  size: number
  modified_at: string
  status: MediaStatus
  usage_count: number
  usages: MediaUsage[]
}

export type MediaStats = {
  file_count: number
  total_bytes: number
  used_count: number
  unused_count: number
  unused_bytes: number
  recent_count: number
  protected_count: number
  trash_count: number
  trash_bytes: number
  disk: { total_bytes: number; free_bytes: number } | null
}

export type TrashItem = {
  id: string
  name: string
  size: number
  trashed_at: string
  deletes_at: string
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "–"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const IMAGE = /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i
const VIDEO = /\.(mp4|webm|mov|m4v|ogv)$/i

export const isImage = (name: string) => IMAGE.test(name)
export const isVideo = (name: string) => VIDEO.test(name)

/** The file name without the upload time Medusa puts in front of it. */
export function displayName(name: string): string {
  const base = name.split("/").pop() || name
  return base.replace(/^\d{13}-/, "")
}

export const STATUS_LABEL: Record<MediaStatus, string> = {
  used: "In use",
  unused: "Unused",
  recent: "New",
  protected: "Protected",
}

export const STATUS_HELP: Record<MediaStatus, string> = {
  used: "Something on the shop shows this file.",
  unused: "Nothing uses it. The cleanup moves it to the trash.",
  recent: "Nothing uses it yet, but it was uploaded in the last days, so it is kept for now.",
  protected: "Not an upload from the admin (for example the invoice logo). Never cleaned up.",
}

const TABLE_LABEL: Record<string, string> = {
  image: "Product picture",
  product: "Product",
  product_variant: "Product variant",
  product_category: "Category",
  product_collection: "Collection",
  store: "Store settings",
  page: "Page",
  blog_post: "Blog post",
  blog_category: "Blog category",
  order_line_item: "Order",
  line_item: "Shopping cart",
  translation: "Translation",
  notification: "Sent email",
}

/** A readable name and, where the admin has a page for it, a link. */
export function describeUsage(usage: MediaUsage): { label: string; href: string | null } {
  const label = TABLE_LABEL[usage.table] || usage.table.replace(/_/g, " ")
  const productId =
    usage.table === "product" ? usage.id : usage.product_id
  if (productId) return { label, href: `/app/products/${productId}` }
  if (usage.table === "store") return { label, href: "/app/settings/store" }
  if (usage.table === "page") return { label, href: "/app/pages" }
  if (usage.table === "blog_post" || usage.table === "blog_category") {
    return { label, href: "/app/blog" }
  }
  if (usage.table === "product_category" && usage.id) {
    return { label, href: `/app/categories/${usage.id}` }
  }
  if (usage.table === "product_collection" && usage.id) {
    return { label, href: `/app/collections/${usage.id}` }
  }
  return { label, href: null }
}

/** One line per place, e.g. "Product (2), Order (5)". */
export function summarizeUsages(usages: MediaUsage[]): string {
  const counts = new Map<string, number>()
  for (const usage of usages) {
    const { label } = describeUsage(usage)
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return [...counts]
    .map(([label, n]) => (n > 1 ? `${label} (${n})` : label))
    .join(", ")
}
