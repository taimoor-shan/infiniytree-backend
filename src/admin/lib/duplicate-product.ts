import { slugify } from "./slugify"

/**
 * What the Duplicate dialog starts with in the title field: the product's own
 * title with (Copy) after it, which the admin changes to the new product's name.
 */
export const suggestedCopyTitle = (title: string): string =>
  `${title.trim()} (Copy)`

/**
 * The address (handle) the server will give the copy: its title as a handle,
 * the same rule as `copyHandle` in `src/utils/duplicate-product.ts`. When that
 * address is taken the server adds -2, -3 … to it, which the dialog says.
 */
export const copyAddress = (title: string): string => slugify(title) || "product"
