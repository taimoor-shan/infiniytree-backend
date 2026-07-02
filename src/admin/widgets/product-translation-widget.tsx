import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Container, Heading, Text, Button, toast } from "@medusajs/ui"
import { sdk } from "../lib/client"
import { useState } from "react"

const ProductTranslationWidget = ({ data: product }: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleTranslate = async () => {
    setIsLoading(true)
    try {
      const response = await sdk.client.fetch(`/admin/products/${product.id}/translate`, {
        method: "POST"
      })
      toast.success("Translation Started", {
        description: "The product is being translated in the background."
      })
    } catch (error: any) {
      toast.error("Translation Failed", {
        description: error.message || "An error occurred while translating the product."
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container className="p-6">
      <div className="flex flex-col gap-4">
        <div>
          <Heading level="h2">Auto-Translate Product</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Generate translations for this product's title, description, and metadata using the configured AI engine.
          </Text>
        </div>
        <div>
          <Button 
            variant="secondary" 
            size="small" 
            onClick={handleTranslate} 
            isLoading={isLoading}
          >
            Translate Product
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductTranslationWidget
