import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Container, Heading, Text, Button, toast } from "@medusajs/ui"
import { sdk } from "../lib/client"
import { useState } from "react"

type TranslationResult = {
  completed: string[]
  failed: { locale: string; reason: string }[]
  duration_ms: number
}

const ProductTranslationWidget = ({ data: product }: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleTranslate = async () => {
    setIsLoading(true)
    try {
      const result: TranslationResult = await sdk.client.fetch(
        `/admin/products/${product.id}/translate`,
        { method: "POST" }
      )

      if (result.completed.length > 0 && result.failed.length === 0) {
        toast.success("Translation Complete", {
          description: `Translated to ${result.completed.join(", ")} in ${(result.duration_ms / 1000).toFixed(1)}s`,
        })
      } else if (result.completed.length > 0 && result.failed.length > 0) {
        toast.warning("Partial Translation", {
          description: `Completed: ${result.completed.join(", ")}. Failed: ${result.failed.map((f) => f.locale).join(", ")}`,
        })
      } else if (result.failed.length > 0) {
        toast.error("Translation Failed", {
          description: result.failed.map((f) => `${f.locale}: ${f.reason}`).join("; "),
        })
      }
    } catch (error: any) {
      toast.error("Translation Error", {
        description: error.message || "An unexpected error occurred.",
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
            Generate translations for this product's title, description, and
            metadata using the configured AI engine.
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
