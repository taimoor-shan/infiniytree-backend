import { useEffect, useState } from "react"
import {
  Button,
  FocusModal,
  Input,
  StatusBadge,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"
import { localeName } from "../../lib/options"
import RichTextEditor from "../rich-text-editor"
import {
  ContentField,
  ContentReference,
  TRANSLATION_QUERY_KEY,
  TranslateResult,
  TranslationState,
  translatedFieldCount,
  translatableFieldCount,
} from "./types"

type TranslationEditorProps = {
  reference: ContentReference
  recordId: string
  state: TranslationState
  /** The language being edited. */
  locale: string
  /** Query key prefix of the list that shows this record, refreshed on save. */
  listKey: string
  open: boolean
  onClose: () => void
}

const FieldInput = ({
  field,
  value,
  onChange,
}: {
  field: ContentField
  value: string
  onChange: (value: string) => void
}) => {
  if (field.kind === "html") {
    return <RichTextEditor value={value} onChange={onChange} />
  }

  if (field.kind === "textarea") {
    return (
      <Textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <Input value={value} onChange={(event) => onChange(event.target.value)} />
  )
}

/** The original text of a field, read-only, for translating against. */
const Original = ({ field, value }: { field: ContentField; value: string }) => {
  if (!value.trim()) {
    return (
      <Text size="small" leading="compact" className="text-ui-fg-muted">
        (empty)
      </Text>
    )
  }

  if (field.kind === "html") {
    return (
      <div
        className="max-h-[420px] overflow-auto text-ui-fg-subtle text-sm [&_a]:underline [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-medium [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-medium [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-medium [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    )
  }

  return (
    <Text size="small" leading="compact" className="whitespace-pre-wrap text-ui-fg-subtle">
      {value}
    </Text>
  )
}

/**
 * Edit one language's translation of a page, post or category, with the
 * original beside it. Saving keeps what is filled and removes what is blank,
 * so a field left empty shows the original language to visitors.
 */
const TranslationEditor = ({
  reference,
  recordId,
  state,
  locale,
  listKey,
  open,
  onClose,
}: TranslationEditorProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const existing = state.translations[locale]
  const [values, setValues] = useState<Record<string, string>>({})
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Fill the form from what is stored, once per language and save, so a
  // refetch never overwrites what the editor has typed since.
  const loadKey = `${recordId}:${locale}:${existing?.updated_at ?? "none"}`

  useEffect(() => {
    if (!open) {
      setLoadedFor(null)
      return
    }

    if (loadedFor !== loadKey) {
      setValues(
        Object.fromEntries(
          state.fields.map((field) => [field.key, existing?.values[field.key] ?? ""])
        )
      )
      setLoadedFor(loadKey)
    }
  }, [open, loadKey, loadedFor, state.fields, existing])

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: [TRANSLATION_QUERY_KEY, reference, recordId],
    })
    queryClient.invalidateQueries({ queryKey: [listKey] })
  }

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/content-translations/${reference}/${recordId}`, {
        method: "POST",
        body: { locale, values },
      }),
    onSuccess: () => {
      refresh()
      toast.success(`${localeName(locale)} translation saved`)
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to save the translation")
    },
  })

  const autoTranslate = useMutation({
    mutationFn: () =>
      sdk.client.fetch<TranslateResult>(
        `/admin/content-translations/${reference}/${recordId}/translate`,
        { method: "POST", body: { locales: [locale], overwrite: true } }
      ),
    onSuccess: (result) => {
      refresh()

      if (result.failed.length) {
        toast.error("Translation failed", {
          description: result.failed.map((f) => f.reason).join("; "),
        })
      } else {
        toast.success(`Translated into ${localeName(locale)}`)
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to translate")
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(
        `/admin/content-translations/${reference}/${recordId}?locale=${encodeURIComponent(locale)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      refresh()
      toast.success(`${localeName(locale)} translation removed`)
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to remove the translation")
    },
  })

  const busy = save.isPending || autoTranslate.isPending || remove.isPending

  const onAutoTranslate = async () => {
    if (existing) {
      const confirmed = await prompt({
        title: `Translate ${localeName(locale)} again?`,
        description:
          "This replaces the current translation with a new automatic one. Your edits to it are lost.",
        confirmText: "Translate again",
        cancelText: "Cancel",
      })

      if (!confirmed) {
        return
      }
    }

    autoTranslate.mutate()
  }

  const onRemove = async () => {
    const confirmed = await prompt({
      title: `Remove the ${localeName(locale)} translation?`,
      description:
        "Visitors in that language will see the original text. The original is not changed.",
      confirmText: "Remove",
      cancelText: "Cancel",
    })

    if (confirmed) {
      remove.mutate()
    }
  }

  // Only fields that have text to translate, or that already carry a translation.
  const visibleFields = state.fields.filter(
    (field) =>
      !!state.source.values[field.key]?.trim() || !!existing?.values[field.key]
  )

  const done = translatedFieldCount(state, locale)
  const total = translatableFieldCount(state)

  return (
    <FocusModal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <FocusModal.Content>
        <div className="flex h-full flex-col overflow-hidden">
          <FocusModal.Title className="sr-only">
            {localeName(locale)} translation
          </FocusModal.Title>
          <FocusModal.Description className="sr-only">
            Translate this content into {localeName(locale)}.
          </FocusModal.Description>
          <FocusModal.Header>
            <div className="flex w-full items-center justify-between gap-x-2">
              <div className="flex items-center gap-x-3">
                <Text size="small" leading="compact" weight="plus">
                  {localeName(state.source.locale)} → {localeName(locale)}
                </Text>
                <StatusBadge color={done === total && total > 0 ? "green" : "grey"}>
                  {done}/{total} fields
                </StatusBadge>
                {existing && (
                  <Button
                    size="small"
                    variant="danger"
                    onClick={onRemove}
                    disabled={busy}
                  >
                    Remove translation
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-x-2">
                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary">
                    Close
                  </Button>
                </FocusModal.Close>
                {state.provider.configured && (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={onAutoTranslate}
                    isLoading={autoTranslate.isPending}
                    disabled={busy}
                  >
                    {existing ? "Translate again" : "Translate automatically"}
                  </Button>
                )}
                <Button
                  size="small"
                  onClick={() => save.mutate()}
                  isLoading={save.isPending}
                  disabled={busy}
                >
                  Save translation
                </Button>
              </div>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex-1 overflow-auto p-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-y-8">
              {!visibleFields.length && (
                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                  The original has no text to translate yet.
                </Text>
              )}
              {visibleFields.map((field) => (
                <div key={field.key} className="flex flex-col gap-y-2">
                  <Text size="small" leading="compact" weight="plus">
                    {field.label}
                  </Text>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-y-1">
                      <Text
                        size="xsmall"
                        leading="compact"
                        className="text-ui-fg-muted"
                      >
                        Original ({localeName(state.source.locale)})
                      </Text>
                      <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
                        <Original
                          field={field}
                          value={state.source.values[field.key] ?? ""}
                        />
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-y-1">
                      <Text
                        size="xsmall"
                        leading="compact"
                        className="text-ui-fg-muted"
                      >
                        Translation ({localeName(locale)})
                      </Text>
                      <FieldInput
                        field={field}
                        value={values[field.key] ?? ""}
                        onChange={(value) =>
                          setValues((current) => ({ ...current, [field.key]: value }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                A field left empty shows the original text to visitors in{" "}
                {localeName(locale)}. The address (slug or handle), layout,
                image and publishing settings are shared by every language.
              </Text>
            </div>
          </FocusModal.Body>
        </div>
      </FocusModal.Content>
    </FocusModal>
  )
}

export default TranslationEditor
