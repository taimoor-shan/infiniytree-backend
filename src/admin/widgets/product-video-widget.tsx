import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Field } from "../components/fields"
import ImageUpload from "../components/image-upload"
import { sdk } from "../lib/client"
import {
  checkPosterUrl,
  checkVideoUrl,
  normalizeProductVideo,
  readProductVideo,
  sameProductVideo,
  videoMetadata,
} from "../lib/product-video"

const VideoBox = ({ product }: { product: HttpTypes.AdminProduct }) => {
  const queryClient = useQueryClient()
  const saved = readProductVideo(product.metadata)
  const [form, setForm] = useState(saved)

  const videoError = checkVideoUrl(form.video)
  const posterError = checkPosterUrl(form.poster)
  const dirty = !sameProductVideo(form, saved)

  const save = useMutation({
    mutationFn: () =>
      sdk.admin.product.update(product.id, { metadata: videoMetadata(form) }),
    onSuccess: () => {
      // The product page reads the same record, and so does this widget.
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setForm(normalizeProductVideo(form))
      toast.success("Product video saved")
    },
    onError: (error: Error) => {
      toast.error("Could not save the product video", {
        description: error.message,
      })
    },
  })

  return (
    <Container className="flex flex-col gap-y-4 p-6">
      <div className="flex flex-col gap-y-1">
        <Heading level="h2">Product video</Heading>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Shown in the product gallery after the second image. Its thumbnail is
          a still image with a play button, and the video plays inside the
          gallery.
        </Text>
      </div>

      <Field
        label="Video"
        hint="An MP4 or WebM file, up to 20 MB. A link to the file works as well; YouTube and Vimeo pages do not."
      >
        <ImageUpload
          kind="video"
          value={form.video}
          onChange={(video) => setForm((current) => ({ ...current, video }))}
        />
        {videoError && (
          <Text size="small" leading="compact" className="text-ui-fg-error">
            {videoError}
          </Text>
        )}
      </Field>

      {form.video.trim() && (
        <Field
          label="Still image"
          hint="The video's thumbnail, with the play button on it. Without one, the product's first image is used."
        >
          <ImageUpload
            kind="image"
            value={form.poster}
            onChange={(poster) =>
              setForm((current) => ({ ...current, poster }))
            }
          />
          {posterError && (
            <Text size="small" leading="compact" className="text-ui-fg-error">
              {posterError}
            </Text>
          )}
        </Field>
      )}

      <div className="flex items-center gap-x-2">
        <Button
          size="small"
          type="button"
          onClick={() => save.mutate()}
          disabled={!dirty || !!videoError || !!posterError || save.isPending}
          isLoading={save.isPending}
        >
          Save
        </Button>
        {dirty && (
          <Button
            size="small"
            variant="secondary"
            type="button"
            onClick={() => setForm(saved)}
            disabled={save.isPending}
          >
            Discard changes
          </Button>
        )}
      </div>
    </Container>
  )
}

/**
 * The product video, saved in the product's metadata. The page keeps no state
 * of its own for it: it is read from the product and written back through the
 * ordinary product update, so the storefront's cache is refreshed by the same
 * event as for any other product change.
 */
const ProductVideoWidget = ({
  data: product,
}: DetailWidgetProps<HttpTypes.AdminProduct>) => (
  // Keyed by product: moving from one product to another must not carry the
  // first one's unsaved video along.
  <VideoBox key={product.id} product={product} />
)

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductVideoWidget
