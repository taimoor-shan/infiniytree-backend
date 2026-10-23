import { useState } from "react"
import { Button, StatusBadge, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"
import { localeName } from "../../lib/options"
import TranslationEditor from "./translation-editor"
import {
  ContentReference,
  TRANSLATION_QUERY_KEY,
  TranslateResult,
  TranslationState,
  translatableFieldCount,
  translatedFieldCount,
} from "./types"

type TranslationsBoxProps = {
  reference: ContentReference
  /** The record's id, or null while it has not been saved yet. */
  recordId: string | null
  /** Query key prefix of the list that shows the record, refreshed on change. */
  listKey: string
}

/** What a translation shares with its original, as the box says it. */
const SHARED_WITH_ORIGINAL: Record<ContentReference, string> = {
  page: "address, layout and image",
  blog_post: "address, layout and image",
  blog_category: "address",
}

/**
 * Translations of a page, post or category, the way products have them: the
 * original is written once and translated, there is no second record and no
 * second slug. Shows which languages exist, translates them all with one
 * click (the same provider as "Translate Product"), and opens an editor to
 * proofread or write one by hand.
 */
const TranslationsBox = ({ reference, recordId, listKey }: TranslationsBoxProps) => {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)

  const { data: state, isLoading } = useQuery({
    queryKey: [TRANSLATION_QUERY_KEY, reference, recordId],
    queryFn: () =>
      sdk.client.fetch<TranslationState>(
        `/admin/content-translations/${reference}/${recordId}`
      ),
    enabled: !!recordId,
    // What was saved a moment ago, never a copy from an earlier visit.
    gcTime: 0,
  })

  const translateAll = useMutation({
    mutationFn: () =>
      sdk.client.fetch<TranslateResult>(
        `/admin/content-translations/${reference}/${recordId}/translate`,
        { method: "POST", body: {} }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [TRANSLATION_QUERY_KEY, reference, recordId],
      })
      queryClient.invalidateQueries({ queryKey: [listKey] })

      if (result.completed.length && !result.failed.length) {
        toast.success("Translation complete", {
          description: `${result.completed.map(localeName).join(", ")} in ${(result.duration_ms / 1000).toFixed(1)}s`,
        })
      } else if (result.completed.length) {
        toast.warning("Partly translated", {
          description: `Done: ${result.completed.map(localeName).join(", ")}. Failed: ${result.failed.map((f) => localeName(f.locale)).join(", ")}`,
        })
      } else {
        toast.error("Translation failed", {
          description: result.failed.map((f) => `${localeName(f.locale)}: ${f.reason}`).join("; "),
        })
      }
    },
    onError: (error: any) => {
      toast.error("Translation failed", {
        description: error?.message || "An unexpected error occurred.",
      })
    },
  })

  return (
    <div className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
      <Text size="small" leading="compact" weight="plus">
        Translations
      </Text>

      {!recordId && (
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Save this first, then translate it into other languages here. There is
          no need to create a second copy with the same address.
        </Text>
      )}

      {recordId && isLoading && (
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Loading...
        </Text>
      )}

      {recordId && state && (
        <>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Written in {localeName(state.source.locale)}. Other languages are
            translations of it and share its {SHARED_WITH_ORIGINAL[reference]}.
          </Text>

          {state.target_locales.length === 0 ? (
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              No target languages are set. Add them to AUTO_TRANSLATE_LOCALES in
              the backend .env (for example hu,de).
            </Text>
          ) : (
            <div className="flex flex-col gap-y-2">
              {state.target_locales.map((locale) => {
                const done = translatedFieldCount(state, locale)
                const total = translatableFieldCount(state)
                const complete = total > 0 && done >= total

                return (
                  <div
                    key={locale}
                    className="flex items-center justify-between gap-x-2"
                  >
                    <div className="flex items-center gap-x-2">
                      <Text size="small" leading="compact">
                        {localeName(locale)}
                      </Text>
                      <StatusBadge
                        color={complete ? "green" : done > 0 ? "orange" : "grey"}
                      >
                        {complete ? "Translated" : done > 0 ? `${done}/${total}` : "Not translated"}
                      </StatusBadge>
                    </div>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => setEditing(locale)}
                      disabled={translateAll.isPending}
                    >
                      {done > 0 ? "Edit" : "Write"}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {state.native_versions.length > 0 && (
            <Text size="small" leading="compact" className="text-ui-tag-orange-text">
              A separate page with this slug exists in{" "}
              {state.native_versions.map((v) => localeName(v.locale)).join(", ")}.
              It is shown to visitors in that language instead of a translation.
              Delete it to use the translation.
            </Text>
          )}

          {state.provider.configured ? (
            state.target_locales.length > 0 && (
              <div className="flex flex-col gap-y-1">
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => translateAll.mutate()}
                  isLoading={translateAll.isPending}
                >
                  Translate all languages
                </Button>
                <Text size="xsmall" leading="compact" className="text-ui-fg-muted">
                  Fills only what is still missing, so translations you have
                  edited are kept.
                </Text>
              </div>
            )
          ) : (
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Automatic translation is not set up on the server (TRANSLATION_PROVIDER
              in the backend .env). You can still write translations by hand.
            </Text>
          )}

          {editing && recordId && (
            <TranslationEditor
              reference={reference}
              recordId={recordId}
              state={state}
              locale={editing}
              listKey={listKey}
              open
              onClose={() => setEditing(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

export default TranslationsBox
