import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Field } from "../components/fields"
import ImageUpload from "../components/image-upload"
import { sdk } from "../lib/client"
import {
  DEFAULT_MOBILE_HEIGHT,
  MAX_HEIGHT,
  MIN_HEIGHT,
  checkHeight,
  checkPosterUrl,
  checkVideoUrl,
  normalizeHomeBanner,
  readHomeBanner,
  sameHomeBanner,
  withHomeBanner,
} from "../lib/home-banner"

const ErrorText = ({ children }: { children: React.ReactNode }) => (
  <Text size="small" leading="compact" className="text-ui-fg-error">
    {children}
  </Text>
)

const BannerBox = ({ store }: { store: HttpTypes.AdminStore }) => {
  const queryClient = useQueryClient()
  const saved = readHomeBanner(store.metadata)
  const [form, setForm] = useState(saved)

  const videoError = checkVideoUrl(form.video)
  const posterError = checkPosterUrl(form.poster)
  const desktopError = checkHeight(form.heightDesktop)
  const mobileError = checkHeight(form.heightMobile)
  const hasError = !!(videoError || posterError || desktopError || mobileError)
  const dirty = !sameHomeBanner(form, saved)

  const save = useMutation({
    // The store's metadata is replaced as a whole when saved, so the keys that
    // are not the banner's are sent back with it (see `withHomeBanner`).
    mutationFn: () =>
      sdk.admin.store.update(store.id, {
        metadata: withHomeBanner(store.metadata, form),
      }),
    onSuccess: () => {
      // The store page reads the same record, and so does this widget.
      queryClient.invalidateQueries({ queryKey: ["store"] })
      setForm(normalizeHomeBanner(form))
      toast.success("Homepage banner saved")
    },
    onError: (error: Error) => {
      toast.error("Could not save the homepage banner", {
        description: error.message,
      })
    },
  })

  return (
    <Container className="flex flex-col gap-y-4 p-6">
      <div className="flex flex-col gap-y-1">
        <Heading level="h2">Homepage video banner</Heading>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          A full-width video under the Best Sellers on the homepage. It plays
          silently, on a loop, when it scrolls into view, with no controls. The
          picture is never stretched: when the box is not the video's shape, its
          sides (or top and bottom) are trimmed and the middle stays in view.
        </Text>
      </div>

      <Field
        label="Video"
        hint="An MP4 or WebM file, up to 20 MB. A link to the file works as well; YouTube and Vimeo pages do not. It is shown as uploaded, so upload the file ready for the web."
      >
        <ImageUpload
          kind="video"
          value={form.video}
          onChange={(video) => setForm((current) => ({ ...current, video }))}
        />
        {videoError && <ErrorText>{videoError}</ErrorText>}
      </Field>

      {form.video.trim() && (
        <Field
          label="Still image"
          hint="Shown while the video loads, and instead of it for visitors who save data or prefer less motion. Use a frame from the video, in the same shape, so nothing jumps when it starts."
        >
          <ImageUpload
            kind="image"
            value={form.poster}
            onChange={(poster) =>
              setForm((current) => ({ ...current, poster }))
            }
          />
          {posterError && <ErrorText>{posterError}</ErrorText>}
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Height on computers (px)"
          hint={`From 1024 px wide up. Empty keeps the video's own proportions, so the whole picture shows at any width (recommended). A number from ${MIN_HEIGHT} to ${MAX_HEIGHT} sets a fixed height.`}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_HEIGHT}
            max={MAX_HEIGHT}
            step={10}
            placeholder="Automatic"
            value={form.heightDesktop}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                heightDesktop: event.target.value,
              }))
            }
          />
          {desktopError && <ErrorText>{desktopError}</ErrorText>}
        </Field>

        <Field
          label="Height on phones and tablets (px)"
          hint={`Below 1024 px wide. Empty uses ${DEFAULT_MOBILE_HEIGHT}. A number from ${MIN_HEIGHT} to ${MAX_HEIGHT} sets a fixed height.`}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_HEIGHT}
            max={MAX_HEIGHT}
            step={10}
            placeholder={String(DEFAULT_MOBILE_HEIGHT)}
            value={form.heightMobile}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                heightMobile: event.target.value,
              }))
            }
          />
          {mobileError && <ErrorText>{mobileError}</ErrorText>}
        </Field>
      </div>

      <div className="flex items-center gap-x-3">
        <Switch
          id="home-banner-visible"
          checked={!form.hidden}
          onCheckedChange={(visible) =>
            setForm((current) => ({ ...current, hidden: !visible }))
          }
        />
        <Label htmlFor="home-banner-visible" size="small" weight="plus">
          Show the banner on the homepage
        </Label>
      </div>

      <div className="flex items-center gap-x-2">
        <Button
          size="small"
          type="button"
          onClick={() => save.mutate()}
          disabled={!dirty || hasError || save.isPending}
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
 * The homepage video banner, saved in the store's metadata. The page keeps no
 * state of its own for it: it is read from the store and written back through
 * the ordinary store update. Medusa announces no store change (there is no
 * `store.updated` event), so it is `src/api/admin/stores/middlewares.ts` that
 * tells the storefront to refresh once that update succeeds; that is why a saved
 * banner shows on the site at once.
 */
const HomeBannerWidget = ({
  data: store,
}: DetailWidgetProps<HttpTypes.AdminStore>) => (
  // Keyed by store: the box must start from the saved banner, not carry an
  // unsaved one along from another record.
  <BannerBox key={store.id} store={store} />
)

export const config = defineWidgetConfig({
  zone: "store.details.after",
})

export default HomeBannerWidget
