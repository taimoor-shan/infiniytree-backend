import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Container, Heading, Text } from "@medusajs/ui"
import {
  ViewOnStorefront,
  useStorefrontLinks,
} from "../components/view-on-storefront"
import { productViewUrl } from "../lib/storefront"

const UNAVAILABLE = "Publish the product to view it on the storefront."

/**
 * "View on storefront" for a product. The product page has no slot for a button
 * in its header, so this is a small card in its side column (Medusa's layout
 * puts widgets after the page's own sections, so it comes last there). A
 * product's text is translated rather than written in one language, so it opens
 * in English and in German.
 */
const ProductStorefrontLink = ({
  data: product,
}: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const links = useStorefrontLinks()
  const live = product.status === "published"

  return (
    <Container className="flex flex-col gap-y-3 px-6 py-4">
      <div className="flex flex-col gap-y-1">
        <Heading level="h2">Storefront</Heading>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {live ? "Open the published product page in a new tab." : UNAVAILABLE}
        </Text>
      </div>
      <div className="flex items-center gap-x-2">
        <ViewOnStorefront
          url={live ? productViewUrl(links, product, "en") : null}
          label="English"
          unavailable={UNAVAILABLE}
        />
        <ViewOnStorefront
          url={live ? productViewUrl(links, product, "de") : null}
          label="German"
          unavailable={UNAVAILABLE}
        />
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductStorefrontLink
