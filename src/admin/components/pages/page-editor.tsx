import { useEffect, useState } from "react"
import {
  Button,
  FocusModal,
  Input,
  Select,
  StatusBadge,
  Switch,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"
import { LOCALES, PAGE_TEMPLATES } from "../../lib/options"
import { slugify } from "../../lib/slugify"
import { pageViewUrl } from "../../lib/storefront"
import { Box, Field } from "../fields"
import HiddenTitle from "../hidden-title"
import ImageUpload from "../image-upload"
import RichTextEditor from "../rich-text-editor"
import TranslationsBox from "../translations/translations-box"
import { TRANSLATION_QUERY_KEY } from "../translations/types"
import { ViewOnStorefront, useStorefrontLinks } from "../view-on-storefront"
import {
  PAGE_QUERY_KEYS,
  PAGE_STATE_BADGE,
  Page,
  PageResponse,
  pageState,
} from "./types"

type PageFormState = {
  title: string
  slug: string
  locale: string
  excerpt: string
  content: string
  featured_image: string
  hero_video_url: string
  template: string
  seo_title: string
  seo_description: string
  status: "draft" | "published"
  is_public: boolean
}

const EMPTY_FORM: PageFormState = {
  title: "",
  slug: "",
  locale: "en",
  excerpt: "",
  content: "",
  featured_image: "",
  hero_video_url: "",
  template: "default",
  seo_title: "",
  seo_description: "",
  status: "draft",
  // Nothing goes live before it is published, so a new page starts visible and
  // "Publish" is all it takes.
  is_public: true,
}

const SEO_TITLE_MAX = 60
const SEO_DESCRIPTION_MAX = 155

/** What the storefront accepts as one part of a page address. */
const SLUG_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const MAX_SLUG_DEPTH = 4

/** Why the storefront could not serve a page at this slug, or null. */
const slugProblem = (slug: string): string | null => {
  if (!slug) {
    return null
  }

  const segments = slug.split("/")

  if (segments.length > MAX_SLUG_DEPTH) {
    return `An address can have at most ${MAX_SLUG_DEPTH} parts separated by slashes.`
  }

  return segments.every((segment) => SLUG_SEGMENT.test(segment))
    ? null
    : "Use letters, numbers, hyphens and underscores, with one slash between parts (guides/plant-care). No spaces, accents, or a slash at the start or end."
}

/** What is stored for the page, which is what visitors see: only a save changes it. */
type SavedPage = Pick<Page, "status" | "is_public"> & {
  slug: string
  locale: string
}

const NOT_SAVED: SavedPage = {
  status: "draft",
  is_public: false,
  slug: "",
  locale: "en",
}

const fromPage = (page: Page): PageFormState => ({
  title: page.title || "",
  slug: page.slug || "",
  locale: page.locale || "en",
  excerpt: page.excerpt || "",
  content: page.content || "",
  featured_image: page.featured_image || "",
  hero_video_url: page.hero_video_url || "",
  template: page.template || "default",
  seo_title: page.seo_title || "",
  seo_description: page.seo_description || "",
  status: page.status || "draft",
  is_public: page.is_public ?? false,
})

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

type PageEditorProps = {
  open: boolean
  /** The page to edit, or null to write a new one. */
  pageId: string | null
  onClose: () => void
}

/**
 * Full-screen page editor, laid out like the blog post editor: the writing on
 * the left, what surrounds it (visibility, language, layout, translations,
 * images, search) on the right.
 *
 * Saving keeps the editor open, so a long page can be saved as often as needed;
 * creating switches the editor to editing the new page, which is also what
 * makes its Translations available.
 */
const PageEditor = ({ open, pageId, onClose }: PageEditorProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [activeId, setActiveId] = useState<string | null>(pageId)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [form, setForm] = useState<PageFormState>(EMPTY_FORM)
  const [slugTouched, setSlugTouched] = useState(false)
  // The slug as stored. An address that was saved before these checks existed
  // is accepted as it is until it is changed.
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedPage>(NOT_SAVED)

  const isEdit = !!activeId

  useEffect(() => {
    if (open) {
      setActiveId(pageId)
      setLoadedId(null)
      setSavedSlug(null)
      setSaved(NOT_SAVED)

      if (!pageId) {
        setForm(EMPTY_FORM)
        setSlugTouched(false)
      }
    }
  }, [open, pageId])

  // gcTime 0: the form must start from what is stored now, never from a copy
  // left in the cache by an earlier visit.
  const { data: detail, isError } = useQuery({
    queryKey: [PAGE_QUERY_KEYS.page, activeId],
    queryFn: () => sdk.client.fetch<PageResponse>(`/admin/pages/${activeId}`),
    enabled: open && !!activeId,
    gcTime: 0,
  })

  const links = useStorefrontLinks(open)

  // Fill the form once per page. A later refetch must not overwrite what the
  // editor has typed since.
  useEffect(() => {
    if (detail?.page && detail.page.id !== loadedId) {
      setForm(fromPage(detail.page))
      setSavedSlug(detail.page.slug)
      setSaved({
        status: detail.page.status || "draft",
        is_public: detail.page.is_public ?? false,
        slug: detail.page.slug,
        locale: detail.page.locale || "en",
      })
      setSlugTouched(true)
      setLoadedId(detail.page.id)
    }
  }, [detail, loadedId])

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      sdk.client.fetch<PageResponse>(
        activeId ? `/admin/pages/${activeId}` : "/admin/pages",
        { method: "POST", body: payload }
      ),
    onSuccess: ({ page }) => {
      // Stay in the editor, on the saved page.
      setActiveId(page.id)
      setLoadedId(page.id)
      setSavedSlug(page.slug)
      setSlugTouched(true)
      setSaved({
        status: page.status,
        is_public: page.is_public,
        slug: page.slug,
        locale: page.locale || "en",
      })
      setForm((current) => ({
        ...current,
        status: page.status,
        is_public: page.is_public,
      }))
      queryClient.invalidateQueries({ queryKey: [PAGE_QUERY_KEYS.pages] })
      queryClient.invalidateQueries({ queryKey: [PAGE_QUERY_KEYS.page, page.id] })
      // The Translations box shows the original: refresh it too.
      queryClient.invalidateQueries({
        queryKey: [TRANSLATION_QUERY_KEY, "page", page.id],
      })
      toast.success(
        page.status !== "published"
          ? "Draft saved"
          : page.is_public
            ? "Page published"
            : "Page saved, but hidden from the storefront"
      )
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to save the page")
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/pages/${activeId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAGE_QUERY_KEYS.pages] })
      toast.success("Page deleted")
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete the page")
    },
  })

  // A saved page is editable once its own data is in the form. Until then the
  // form holds whatever was there before, which must not be saved over it.
  const ready = !isEdit || loadedId === activeId
  const busy = save.isPending || remove.isPending
  const problem = form.slug !== savedSlug ? slugProblem(form.slug) : null
  const canSave =
    ready &&
    form.title.trim().length > 0 &&
    form.slug.trim().length > 0 &&
    !problem

  const isLive = isEdit && saved.status === "published"
  // Only a published, visible page is on the storefront to be looked at.
  const viewUrl = isLive && saved.is_public ? pageViewUrl(links, saved) : null
  const publishLabel = isLive ? "Update" : "Publish"

  const set = <K extends keyof PageFormState>(key: K, value: PageFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const onTitleChange = (title: string) =>
    setForm((current) => ({
      ...current,
      title,
      // The slug follows the title until the editor sets one. A saved page
      // keeps its address when the title is reworded.
      ...(slugTouched || isEdit ? {} : { slug: slugify(title) }),
    }))

  const submit = (status: "draft" | "published") => {
    save.mutate({
      title: form.title.trim(),
      slug: form.slug.trim(),
      locale: form.locale,
      excerpt: form.excerpt.trim() || null,
      content: form.content || null,
      featured_image: form.featured_image || null,
      hero_video_url: form.hero_video_url || null,
      template: form.template,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      status,
      is_public: form.is_public,
    })
  }

  const onDelete = async () => {
    const confirmed = await prompt({
      title: "Delete this page?",
      description: `"${form.title}" will be deleted for good, together with its translations. Other pages are not affected.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      remove.mutate()
    }
  }

  const template = PAGE_TEMPLATES.find(
    (option) => option.value === form.template
  )
  const badge = PAGE_STATE_BADGE[pageState(saved)]

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
          <HiddenTitle>{isEdit ? "Edit page" : "New page"}</HiddenTitle>
          <FocusModal.Description className="sr-only">
            Write, translate and publish a page.
          </FocusModal.Description>
          <FocusModal.Header>
            <div className="flex w-full items-center justify-between gap-x-2">
              <div className="flex items-center gap-x-3">
                <StatusBadge color={badge.color}>{badge.label}</StatusBadge>
                {isEdit && (
                  <Button
                    size="small"
                    variant="danger"
                    onClick={onDelete}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-x-2">
                {isEdit && (
                  <ViewOnStorefront
                    url={viewUrl}
                    label="View page"
                    unavailable="Publish the page, and keep it visible on the storefront, to view it there."
                  />
                )}
                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary">
                    Close
                  </Button>
                </FocusModal.Close>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => submit("draft")}
                  disabled={!canSave || busy}
                >
                  {isLive ? "Unpublish" : "Save draft"}
                </Button>
                <Button
                  size="small"
                  onClick={() => submit("published")}
                  isLoading={save.isPending}
                  disabled={!canSave || busy}
                >
                  {publishLabel}
                </Button>
              </div>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex-1 overflow-auto p-6">
            {!ready ? (
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                {isError ? "This page could not be loaded." : "Loading..."}
              </Text>
            ) : (
              <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex flex-col gap-y-6">
                  <Field label="Title">
                    <Input
                      value={form.title}
                      placeholder="About us"
                      onChange={(e) => onTitleChange(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Slug"
                    hint={
                      problem ??
                      "Every language of this page shares this address. Use a slash for a nested address, for example guides/plant-care. Pages built into the storefront (about, contact, the policies) keep their own address."
                    }
                  >
                    <div className="flex items-center gap-x-2">
                      <Text
                        size="small"
                        leading="compact"
                        className="shrink-0 text-ui-fg-subtle"
                      >
                        /
                      </Text>
                      <div className="min-w-0 flex-1">
                        <Input
                          value={form.slug}
                          aria-invalid={!!problem}
                          onChange={(e) => {
                            setSlugTouched(true)
                            set("slug", e.target.value)
                          }}
                        />
                      </div>
                    </div>
                  </Field>
                  <Field
                    label="Excerpt"
                    hint="A short intro shown under the title by most layouts. Also used for search results when no description is set."
                  >
                    <Textarea
                      rows={3}
                      value={form.excerpt}
                      onChange={(e) => set("excerpt", e.target.value)}
                    />
                  </Field>
                  <Field label="Content">
                    <RichTextEditor
                      value={form.content}
                      onChange={(value) => set("content", value)}
                    />
                  </Field>
                </div>

                <div className="flex flex-col gap-y-4">
                  <Box title="Publish">
                    <div className="flex flex-col gap-y-2">
                      <div className="flex items-center gap-x-2">
                        <Switch
                          checked={form.is_public}
                          onCheckedChange={(checked) => set("is_public", checked)}
                        />
                        <Text size="small" leading="compact" weight="plus">
                          Visible on storefront
                        </Text>
                      </div>
                      <Text
                        size="small"
                        leading="compact"
                        className="text-ui-fg-subtle"
                      >
                        Turn this off to keep a published page off the
                        storefront.
                      </Text>
                    </div>
                    <Field
                      label="Language of the text"
                      hint="The language you write this page in. Add the other languages in Translations below: no second copy and no second slug."
                    >
                      <Select
                        value={form.locale}
                        onValueChange={(value) => set("locale", value)}
                      >
                        <Select.Trigger>
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          {LOCALES.map((option) => (
                            <Select.Item key={option.value} value={option.value}>
                              {option.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Field>
                    <Field label="Template" hint={template?.description}>
                      <Select
                        value={form.template}
                        onValueChange={(value) => set("template", value)}
                      >
                        <Select.Trigger>
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          {PAGE_TEMPLATES.map((option) => (
                            <Select.Item key={option.value} value={option.value}>
                              {option.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Field>
                  </Box>

                  <TranslationsBox
                    reference="page"
                    recordId={activeId}
                    listKey={PAGE_QUERY_KEYS.pages}
                  />

                  <Box title="Featured image">
                    <ImageUpload
                      value={form.featured_image}
                      onChange={(value) => set("featured_image", value)}
                    />
                  </Box>

                  <Box title="Hero video">
                    <ImageUpload
                      kind="video"
                      value={form.hero_video_url}
                      onChange={(value) => set("hero_video_url", value)}
                    />
                    <Text
                      size="small"
                      leading="compact"
                      className="text-ui-fg-subtle"
                    >
                      Optional. Plays muted in a loop on desktop. The featured
                      image is used as the poster and shown alone on mobile. MP4
                      or WebM, up to 20 MB.
                    </Text>
                  </Box>

                  <Box title="Search appearance">
                    <div className="flex flex-col gap-y-1 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
                      <Text
                        size="xsmall"
                        leading="compact"
                        className="text-ui-fg-subtle"
                      >
                        infinytree.com › {form.slug || "your-page"}
                      </Text>
                      <Text
                        size="base"
                        leading="compact"
                        weight="plus"
                        className="text-ui-fg-interactive"
                      >
                        {truncate(form.seo_title || form.title, SEO_TITLE_MAX) ||
                          "Page title"}
                      </Text>
                      <Text
                        size="small"
                        leading="compact"
                        className="text-ui-fg-subtle"
                      >
                        {truncate(
                          form.seo_description || form.excerpt,
                          SEO_DESCRIPTION_MAX
                        ) || "A short description shown in search results."}
                      </Text>
                    </div>
                    <Field
                      label="SEO title"
                      counter={{
                        value: form.seo_title.length,
                        max: SEO_TITLE_MAX,
                      }}
                      hint="Leave empty to use the page title."
                    >
                      <Input
                        value={form.seo_title}
                        onChange={(e) => set("seo_title", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="SEO description"
                      counter={{
                        value: form.seo_description.length,
                        max: SEO_DESCRIPTION_MAX,
                      }}
                      hint="Leave empty to use the excerpt, or the start of the page text."
                    >
                      <Textarea
                        rows={3}
                        value={form.seo_description}
                        onChange={(e) => set("seo_description", e.target.value)}
                      />
                    </Field>
                  </Box>
                </div>
              </div>
            )}
          </FocusModal.Body>
        </div>
      </FocusModal.Content>
    </FocusModal>
  )
}

export default PageEditor
