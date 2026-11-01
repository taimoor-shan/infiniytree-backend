import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import {
  Button,
  Container,
  Heading,
  Text,
  clx,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import RichTextEditor from "../components/rich-text-editor"
import { sdk } from "../lib/client"
import {
  LONG_DESCRIPTION_KEY,
  LONG_DESCRIPTION_LANGUAGES,
  LongDescriptionLanguage,
  checkLongDescription,
  isBlankHtml,
  longDescriptionMetadata,
  readLongDescription,
  sameLongDescription,
} from "../lib/product-long-description"

type TranslateResult = {
  translations: Record<string, string>
  failed: { locale: string; reason: string }[]
}

const TRANSLATED = LONG_DESCRIPTION_LANGUAGES.filter(
  (language) => language.id !== "en"
)

const LongDescriptionBox = ({
  product,
}: {
  product: HttpTypes.AdminProduct
}) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const saved = readLongDescription(product.metadata)
  const [form, setForm] = useState(saved)
  const [active, setActive] = useState<LongDescriptionLanguage>("en")
  // The editor is started afresh whenever a text is put into it from outside
  // (discarding changes, a translation), so its undo history never carries one
  // language's words into another.
  const [revision, setRevision] = useState(0)

  const dirty = !sameLongDescription(form, saved)
  const error = checkLongDescription(form)

  const save = useMutation({
    mutationFn: () =>
      sdk.admin.product.update(product.id, {
        metadata: longDescriptionMetadata(
          product.metadata?.[LONG_DESCRIPTION_KEY],
          form
        ),
      }),
    onSuccess: () => {
      // The product page reads the same record, and so does this widget.
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success("Long description saved")
    },
    onError: (error: Error) => {
      toast.error("Could not save the long description", {
        description: error.message,
      })
    },
  })

  const translate = useMutation({
    mutationFn: () =>
      sdk.client.fetch<TranslateResult>(
        `/admin/products/${product.id}/translate-long-description`,
        {
          method: "POST",
          body: {
            html: form.en,
            locales: TRANSLATED.map((language) => language.locale),
          },
        }
      ),
    onSuccess: (result) => {
      const translated = TRANSLATED.filter(
        (language) => result.translations[language.locale]
      )

      if (translated.length) {
        setForm((current) => {
          const next = { ...current }
          for (const language of translated) {
            next[language.id] = result.translations[language.locale]
          }
          return next
        })
        setRevision((current) => current + 1)
      }

      if (result.failed.length) {
        toast.error("Some languages could not be translated", {
          description: result.failed
            .map((failure) => `${failure.locale}: ${failure.reason}`)
            .join("; "),
        })
      } else {
        toast.success("Translated", {
          description:
            "Read the German and Hungarian texts, then press Save. Nothing is saved yet.",
        })
      }
    },
    onError: (error: Error) => {
      toast.error("Could not translate", { description: error.message })
    },
  })

  const onTranslate = async () => {
    if (TRANSLATED.some((language) => !isBlankHtml(form[language.id]))) {
      const confirmed = await prompt({
        title: "Translate the English text again?",
        description:
          "The German and Hungarian texts will be replaced by a new translation of the English one. Nothing is saved until you press Save.",
        confirmText: "Translate",
        cancelText: "Cancel",
      })

      if (!confirmed) {
        return
      }
    }

    translate.mutate()
  }

  const language = LONG_DESCRIPTION_LANGUAGES.find(({ id }) => id === active)!

  return (
    <Container className="flex flex-col gap-y-4 p-6">
      <div className="flex flex-col gap-y-1">
        <Heading level="h2">Long description</Heading>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          The formatted text of the Description section on the product page. The
          Description box above stays the short text under the product's title.
        </Text>
      </div>

      <div className="flex flex-col gap-y-2">
        <div
          role="tablist"
          aria-label="Language"
          className="flex gap-x-1 border-b border-ui-border-base"
        >
          {LONG_DESCRIPTION_LANGUAGES.map(({ id, label }) => {
            const selected = id === active

            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(id)}
                className={clx(
                  "-mb-px flex items-center gap-x-1.5 border-b-2 px-3 py-2 text-sm",
                  selected
                    ? "border-ui-fg-base text-ui-fg-base"
                    : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
                )}
              >
                {label}
                {!isBlankHtml(form[id]) && (
                  <span
                    title="Has a text"
                    className="h-1.5 w-1.5 rounded-full bg-ui-tag-green-icon"
                  />
                )}
              </button>
            )
          })}
        </div>

        <RichTextEditor
          key={`${active}-${revision}`}
          value={form[active]}
          onChange={(html) =>
            setForm((current) => ({ ...current, [active]: html }))
          }
        />

        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {active === "en"
            ? "Written in English. A language without a text of its own shows this one."
            : `Shown to visitors reading the shop in ${language.label}. Without a text here, the English one is shown.`}
        </Text>
        {error && (
          <Text size="small" leading="compact" className="text-ui-fg-error">
            {error}
          </Text>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <Button
          size="small"
          type="button"
          onClick={() => save.mutate()}
          disabled={!dirty || !!error || save.isPending}
          isLoading={save.isPending}
        >
          Save
        </Button>
        {dirty && (
          <Button
            size="small"
            variant="secondary"
            type="button"
            onClick={() => {
              setForm(saved)
              setRevision((current) => current + 1)
            }}
            disabled={save.isPending || translate.isPending}
          >
            Discard changes
          </Button>
        )}
        <Button
          className="sm:ml-auto"
          size="small"
          variant="secondary"
          type="button"
          onClick={onTranslate}
          disabled={
            isBlankHtml(form.en) || translate.isPending || save.isPending
          }
          isLoading={translate.isPending}
        >
          Translate from English
        </Button>
      </div>
    </Container>
  )
}

/**
 * The product's long description, saved in its metadata. The box keeps no state
 * of its own for it: it is read from the product and written back through the
 * ordinary product update, so the storefront's cache is refreshed by the same
 * event as for any other product change. Medusa lays a translation only over
 * the product's own fields, never over its metadata, hence one text per
 * language here (see `src/admin/lib/product-long-description.ts`).
 */
const ProductLongDescriptionWidget = ({
  data: product,
}: DetailWidgetProps<HttpTypes.AdminProduct>) => (
  // Keyed by product: moving from one product to another must not carry the
  // first one's unsaved text along.
  <LongDescriptionBox key={product.id} product={product} />
)

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductLongDescriptionWidget
