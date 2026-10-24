import { ArrowUpRightOnBox } from "@medusajs/icons"
import { Button } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/client"
import type { StorefrontLinks } from "../lib/storefront"

/**
 * Where the storefront is, for the "View" buttons: the same for every page,
 * post and product, so it is fetched once. Undefined until it has loaded.
 */
export const useStorefrontLinks = (enabled = true) =>
  useQuery({
    queryKey: ["storefront-links"],
    queryFn: () => sdk.client.fetch<StorefrontLinks>("/admin/storefront-links"),
    enabled,
    staleTime: Infinity,
  }).data

type ViewOnStorefrontProps = {
  /** The address to open, or null when there is nothing to look at yet. */
  url: string | null
  label: string
  /** Shown instead of the link while `url` is null: what to do to get one. */
  unavailable: string
}

/**
 * Opens a published page, post or product on the storefront in a new tab. Until
 * there is something published to look at, it stays greyed out and says why.
 */
export const ViewOnStorefront = ({
  url,
  label,
  unavailable,
}: ViewOnStorefrontProps) =>
  url ? (
    <Button size="small" variant="secondary" asChild>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Opens the published version on the storefront in a new tab. Changes you have not saved are not in it."
      >
        <ArrowUpRightOnBox />
        {label}
      </a>
    </Button>
  ) : (
    <span title={unavailable}>
      <Button size="small" variant="secondary" disabled>
        <ArrowUpRightOnBox />
        {label}
      </Button>
    </span>
  )
