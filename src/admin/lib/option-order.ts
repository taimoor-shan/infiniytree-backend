/**
 * The order of a product's options and of each option's values, set in the
 * **Option order** box on the product page (`widgets/product-option-order-widget.tsx`).
 *
 *   - Options: Medusa keeps no order for a product's options (the link between
 *     a product and its options has no rank), so the box saves the option ids
 *     in the product's metadata as `option_order`, a list. An option missing
 *     from the list (added later) comes after the listed ones.
 *   - Values: Medusa's own `rank` on each option value, saved with
 *     `POST /admin/product-options/:id` `{ ranks: { <value>: <n> } }`, the
 *     field Medusa's Settings → Product Options editor writes. A value without
 *     a rank (added later) comes after the ranked ones.
 *
 * The storefront reads both: its `src/lib/util/option-order.ts` repeats these
 * rules (keep the two in step), lists the options and values in this order in
 * the buy box, opens on the first variant in this order and orders the gallery
 * by it.
 */

export const OPTION_ORDER_KEY = "option_order"

export type OrderValue = { id: string; value: string; rank?: number | null }
export type OrderOption = {
  id: string
  title: string
  is_exclusive?: boolean | null
  values: OrderValue[]
}

/** The option ids saved in the metadata, or none when the value is not a list of ids. */
export const readOptionOrder = (
  metadata?: Record<string, unknown> | null
): string[] => {
  let raw = metadata?.[OPTION_ORDER_KEY]
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }
  return Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string")
    : []
}

/** A stable sort: equal keys keep the order they came in. */
const stableSortBy = <T>(items: T[], key: (item: T) => number): T[] =>
  items
    .map((item, index) => ({ item, index, key: key(item) }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map(({ item }) => item)

/** Values by their rank, those without one last, in Medusa's order. */
export const sortOptionValues = <V extends { rank?: number | null }>(
  values: V[]
): V[] =>
  stableSortBy(values, (value) =>
    typeof value.rank === "number" ? value.rank : Number.POSITIVE_INFINITY
  )

/** Options in the saved order, each with its values sorted: what the box opens with. */
export const sortProductOptions = <O extends OrderOption>(
  options: O[],
  metadata?: Record<string, unknown> | null
): O[] => {
  const order = readOptionOrder(metadata)
  const place = (id: string) => {
    const index = order.indexOf(id)
    return index === -1 ? Number.POSITIVE_INFINITY : index
  }
  return stableSortBy(options, (option) => place(option.id)).map((option) => ({
    ...option,
    values: sortOptionValues(option.values ?? []),
  }))
}

/** Moves the item at `from` to `to`, as a drag does. */
export const moveItem = <T>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** The ranks to save for an option's values in the order shown: 1, 2, 3… */
export const valueRanks = (values: OrderValue[]): Record<string, number> =>
  Object.fromEntries(values.map((value, index) => [value.value, index + 1]))

/**
 * What saving the box must write, compared with what Medusa holds:
 *   - `optionOrder`: the option ids to save in the metadata, or null when the
 *     saved order already says so;
 *   - `ranks`: for each option whose values are not ranked 1, 2, 3… in the
 *     order shown, the ranks to send.
 */
export const optionOrderChanges = (
  shown: OrderOption[],
  saved: { options: OrderOption[]; metadata?: Record<string, unknown> | null }
): {
  optionOrder: string[] | null
  ranks: { optionId: string; ranks: Record<string, number> }[]
} => {
  const ids = shown.map((option) => option.id)
  const savedOrder = readOptionOrder(saved.metadata)
  const optionOrder =
    savedOrder.length === ids.length && savedOrder.every((id, i) => id === ids[i])
      ? null
      : ids

  const ranks = shown.flatMap((option) => {
    const held = saved.options.find((o) => o.id === option.id)
    const wanted = valueRanks(option.values)
    const same = option.values.every((value) => {
      const current = held?.values.find((v) => v.id === value.id)
      return current?.rank === wanted[value.value]
    })
    return same ? [] : [{ optionId: option.id, ranks: wanted }]
  })

  return { optionOrder, ranks }
}
