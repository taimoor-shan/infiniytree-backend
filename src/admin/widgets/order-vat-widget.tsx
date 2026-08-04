import { useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui"
import { ArrowDownTray, DocumentText } from "@medusajs/icons"

const OrderVatWidget = ({ data: order }: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const [downloading, setDownloading] = useState(false)
  const vatNumber = (order.shipping_address?.metadata as any)?.vat_number as string | undefined
  const company = order.shipping_address?.company

  const handleDownloadInvoice = async () => {
    setDownloading(true)
    try {
      const response = await fetch(`/admin/orders/${order.id}/invoice`, {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to download invoice")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `INV-${order.display_id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Invoice download failed:", err)
    } finally {
      setDownloading(false)
    }
  }

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
      <div className="mt-4">
        <Button
          variant="secondary"
          onClick={handleDownloadInvoice}
          disabled={downloading}
        >
          {downloading ? (
            <span className="flex items-center gap-x-2">
              <DocumentText />
              Downloading...
            </span>
          ) : (
            <span className="flex items-center gap-x-2">
              <ArrowDownTray />
              Download Invoice (PDF)
            </span>
          )}
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderVatWidget
