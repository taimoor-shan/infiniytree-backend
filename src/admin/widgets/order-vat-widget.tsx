import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Container, Heading, Text, Badge } from "@medusajs/ui"

const OrderVatWidget = ({ data: order }: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const vatNumber = (order.shipping_address?.metadata as any)?.vat_number as string | undefined
  const company = order.shipping_address?.company

  return (
    <Container className="p-6">
      <Heading level="h2">VAT / Tax Information</Heading>
      <div className="flex flex-col gap-2 mt-3">
        {company && (
          <div className="flex items-center gap-2">
            <Text size="small" className="text-ui-fg-subtle">
              Company:
            </Text>
            <Text>{company}</Text>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Text size="small" className="text-ui-fg-subtle">
            VAT Number:
          </Text>
          {vatNumber ? (
            <>
              <Text>{vatNumber}</Text>
              <Badge color="green">On file</Badge>
            </>
          ) : (
            <Badge color="red">No VAT number provided</Badge>
          )}
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderVatWidget
