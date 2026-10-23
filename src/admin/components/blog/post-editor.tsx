import { useEffect, useState } from "react"
import {
  Button,
  Checkbox,
  FocusModal,
  Input,
  Label,
  Select,
  StatusBadge,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"
import { LOCALES, POST_TEMPLATES } from "../../lib/options"
import { slugify } from "../../lib/slugify"
import ImageUpload from "../image-upload"
import RichTextEditor from "../rich-text-editor"
import TranslationsBox from "../translations/translations-box"
import { TRANSLATION_QUERY_KEY } from "../translations/types"
import { Box, Field } from "../fields"
import {
  BLOG_QUERY_KEYS,
  BlogPost,
  CategoriesResponse,
  POST_STATE_BADGE,
  PostResponse,
  postState,
} from "./types"

type PostFormState = {
  title: string
  handle: string
  locale: string
  excerpt: string
  content: string
  featured_image: string
  featured_image_alt: string
  author_name: string
  template: string
  status: "draft" | "published"
  /** `datetime-local` value, in the editor's own time zone. */
  published_at: string
  seo_title: string
  seo_description: string
  category_ids: string[]
}

const EMPTY_FORM: PostFormState = {
  title: "",
  handle: "",
  locale: "en",
  excerpt: "",
  content: "",
  featured_image: "",
  featured_image_alt: "",
  author_name: "",
  template: "standard",
  status: "draft",
  published_at: "",
  seo_title: "",
  seo_description: "",
  category_ids: [],
}

const SEO_TITLE_MAX = 60
const SEO_DESCRIPTION_MAX = 155
const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const pad = (value: number) => String(value).padStart(2, "0")

/** ISO date from the API as the value a `datetime-local` input expects. */
const toInputValue = (iso?: string | null) => {
  if (!iso) {
    return ""
  }

  const date = new Date(iso)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const fromInputValue = (value: string) =>
  value ? new Date(value).toISOString() : null

const fromPost = (post: BlogPost): PostFormState => ({
  title: post.title || "",
  handle: post.handle || "",
  locale: post.locale || "en",
  excerpt: post.excerpt || "",
  content: post.content || "",
  featured_image: post.featured_image || "",
  featured_image_alt: post.featured_image_alt || "",
  author_name: post.author_name || "",
  template: post.template || "standard",
  status: post.status || "draft",
  published_at: toInputValue(post.published_at),
  seo_title: post.seo_title || "",
  seo_description: post.seo_description || "",
  category_ids: (post.categories ?? []).map((category) => category.id),
})

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

type PostEditorProps = {
  open: boolean
  /** The post to edit, or null to write a new one. */
  postId: string | null
  onClose: () => void
}

/**
 * Full-screen post editor, laid out like WordPress's: the writing on the left,
 * what surrounds it (publishing, categories, image, search) on the right.
 *
 * Saving keeps the editor open, so a long article can be saved as often as
 * needed; creating switches the editor to editing the new post.
 */
const PostEditor = ({ open, postId, onClose }: PostEditorProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [activeId, setActiveId] = useState<string | null>(postId)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [form, setForm] = useState<PostFormState>(EMPTY_FORM)
  const [handleTouched, setHandleTouched] = useState(false)
  const [readingTime, setReadingTime] = useState<number | null>(null)

  const isEdit = !!activeId

  useEffect(() => {
    if (open) {
      setActiveId(postId)
      setLoadedId(null)
      setReadingTime(null)

      if (!postId) {
        setForm(EMPTY_FORM)
        setHandleTouched(false)
      }
    }
  }, [open, postId])

  // gcTime 0: the form must start from what is stored now, never from a copy
  // left in the cache by an earlier visit.
  const { data: detail, isError } = useQuery({
    queryKey: [BLOG_QUERY_KEYS.post, activeId],
    queryFn: () =>
      sdk.client.fetch<PostResponse>(`/admin/blog/posts/${activeId}`),
    enabled: open && !!activeId,
    gcTime: 0,
  })

  const { data: categoriesData } = useQuery({
    queryKey: [BLOG_QUERY_KEYS.categories],
    queryFn: () =>
      sdk.client.fetch<CategoriesResponse>("/admin/blog/categories"),
    enabled: open,
  })

  // Fill the form once per post. A later refetch must not overwrite what the
  // editor has typed since.
  useEffect(() => {
    if (detail?.post && detail.post.id !== loadedId) {
      setForm(fromPost(detail.post))
      setReadingTime(detail.post.reading_time ?? null)
      setHandleTouched(true)
      setLoadedId(detail.post.id)
    }
  }, [detail, loadedId])

  // Categories are translated like posts, so every one is offered whatever
  // language the post is written in.
  const categories = categoriesData?.categories ?? []

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      sdk.client.fetch<PostResponse>(
        activeId ? `/admin/blog/posts/${activeId}` : "/admin/blog/posts",
        { method: "POST", body: payload }
      ),
    onSuccess: ({ post }) => {
      // Stay in the editor, on the saved post. The server may have stamped a
      // publish date, which the form should now show.
      setActiveId(post.id)
      setLoadedId(post.id)
      setHandleTouched(true)
      setReadingTime(post.reading_time ?? null)
      setForm((current) => ({
        ...current,
        status: post.status,
        published_at: toInputValue(post.published_at),
      }))
      queryClient.invalidateQueries({ queryKey: [BLOG_QUERY_KEYS.posts] })
      queryClient.invalidateQueries({ queryKey: [BLOG_QUERY_KEYS.post, post.id] })
      // The Translations box shows the original: refresh it too.
      queryClient.invalidateQueries({
        queryKey: [TRANSLATION_QUERY_KEY, "blog_post", post.id],
      })
      toast.success(
        post.status === "published"
          ? postState(post) === "scheduled"
            ? "Post scheduled"
            : "Post published"
          : "Draft saved"
      )
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to save the post")
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/blog/posts/${activeId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BLOG_QUERY_KEYS.posts] })
      toast.success("Post deleted")
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete the post")
    },
  })

  // A saved post is editable once its own data is in the form. Until then the
  // form holds whatever was there before, which must not be saved over it.
  const ready = !isEdit || loadedId === activeId
  const busy = save.isPending || remove.isPending
  const handleValid = HANDLE_PATTERN.test(form.handle) && form.handle !== "category"
  const canSave = ready && form.title.trim().length > 0 && handleValid

  const scheduledFor = fromInputValue(form.published_at)
  const state = postState({ status: form.status, published_at: scheduledFor })
  const isLive = isEdit && form.status === "published"
  const isFuture = !!scheduledFor && new Date(scheduledFor).getTime() > Date.now()
  const publishLabel = isFuture ? "Schedule" : isLive ? "Update" : "Publish"

  const set = <K extends keyof PostFormState>(key: K, value: PostFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const onTitleChange = (title: string) =>
    setForm((current) => ({
      ...current,
      title,
      // The permalink follows the title until the editor sets one, as in
      // WordPress. A saved post keeps its address when the title is reworded.
      ...(handleTouched || isEdit ? {} : { handle: slugify(title) }),
    }))

  const toggleCategory = (id: string, checked: boolean) =>
    setForm((current) => ({
      ...current,
      category_ids: checked
        ? [...current.category_ids, id]
        : current.category_ids.filter((existing) => existing !== id),
    }))

  const submit = (status: "draft" | "published") => {
    save.mutate({
      title: form.title.trim(),
      handle: form.handle,
      locale: form.locale,
      excerpt: form.excerpt.trim() || null,
      content: form.content || null,
      featured_image: form.featured_image || null,
      featured_image_alt: form.featured_image_alt.trim() || null,
      author_name: form.author_name.trim() || null,
      template: form.template,
      status,
      published_at: fromInputValue(form.published_at),
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      category_ids: form.category_ids,
    })
  }

  const onDelete = async () => {
    const confirmed = await prompt({
      title: "Delete this post?",
      description: `"${form.title}" will be deleted for good. Versions of it in other languages are not affected.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      remove.mutate()
    }
  }

  const template = POST_TEMPLATES.find((option) => option.value === form.template)
  const badge = POST_STATE_BADGE[state]

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
            {isEdit ? "Edit post" : "New post"}
          </FocusModal.Title>
          <FocusModal.Description className="sr-only">
            Write, schedule and publish a blog post.
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
                {isError ? "This post could not be loaded." : "Loading..."}
              </Text>
            ) : (
              <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex flex-col gap-y-6">
                  <Field label="Title">
                    <Input
                      value={form.title}
                      placeholder="Caring for an artificial olive tree"
                      onChange={(e) => onTitleChange(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Permalink"
                    hint={
                      form.handle && !handleValid
                        ? "Use lowercase letters, numbers and single hyphens only (and not “category”)."
                        : "Every language of this post shares this address. Changing it later breaks existing links."
                    }
                  >
                    <div className="flex items-center gap-x-2">
                      <Text
                        size="small"
                        leading="compact"
                        className="shrink-0 text-ui-fg-subtle"
                      >
                        /blog/
                      </Text>
                      <div className="min-w-0 flex-1">
                        <Input
                          value={form.handle}
                          aria-invalid={!!form.handle && !handleValid}
                          onChange={(e) => {
                            setHandleTouched(true)
                            set("handle", e.target.value)
                          }}
                        />
                      </div>
                    </div>
                  </Field>
                  <Field
                    label="Excerpt"
                    hint="A short summary shown on blog cards and used for search results when no description is set."
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
                    <Field
                      label="Publish date"
                      hint="In your local time. Leave empty to publish right away; a date in the future schedules the post."
                    >
                      <Input
                        type="datetime-local"
                        value={form.published_at}
                        onChange={(e) => set("published_at", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Language of the text"
                      hint="The language you write this post in. Add the other languages in Translations below: no second copy and no second permalink."
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
                          {POST_TEMPLATES.map((option) => (
                            <Select.Item key={option.value} value={option.value}>
                              {option.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </Field>
                    {readingTime && (
                      <Text
                        size="small"
                        leading="compact"
                        className="text-ui-fg-subtle"
                      >
                        About {readingTime} min read
                      </Text>
                    )}
                  </Box>

                  <TranslationsBox
                    reference="blog_post"
                    recordId={activeId}
                    listKey={BLOG_QUERY_KEYS.posts}
                  />

                  <Box title="Categories">
                    {categories.length === 0 ? (
                      <Text
                        size="small"
                        leading="compact"
                        className="text-ui-fg-subtle"
                      >
                        No categories yet. Add some on the Categories tab.
                      </Text>
                    ) : (
                      <div className="flex flex-col gap-y-2">
                        {categories.map((category) => (
                          <div
                            key={category.id}
                            className="flex items-center gap-x-2"
                          >
                            <Checkbox
                              id={`post-category-${category.id}`}
                              checked={form.category_ids.includes(category.id)}
                              onCheckedChange={(checked) =>
                                toggleCategory(category.id, checked === true)
                              }
                            />
                            <Label
                              htmlFor={`post-category-${category.id}`}
                              size="small"
                              weight="regular"
                            >
                              {category.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </Box>

                  <Box title="Featured image">
                    <ImageUpload
                      value={form.featured_image}
                      onChange={(value) => set("featured_image", value)}
                    />
                    <Field
                      label="Image description"
                      hint="Describe the picture for visitors who cannot see it and for image search."
                    >
                      <Input
                        value={form.featured_image_alt}
                        onChange={(e) => set("featured_image_alt", e.target.value)}
                      />
                    </Field>
                  </Box>

                  <Box title="Author">
                    <Input
                      value={form.author_name}
                      placeholder="Infinytree"
                      onChange={(e) => set("author_name", e.target.value)}
                    />
                  </Box>

                  <Box title="Search appearance">
                    <div className="flex flex-col gap-y-1 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
                      <Text
                        size="xsmall"
                        leading="compact"
                        className="text-ui-fg-subtle"
                      >
                        infinytree.com › blog › {form.handle || "your-post"}
                      </Text>
                      <Text
                        size="base"
                        leading="compact"
                        weight="plus"
                        className="text-ui-fg-interactive"
                      >
                        {truncate(
                          form.seo_title ||
                            (form.title ? `${form.title} | Infinytree` : ""),
                          SEO_TITLE_MAX
                        ) || "Post title"}
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
                      hint="Leave empty to use the post title followed by “| Infinytree”."
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
                      hint="Leave empty to use the excerpt."
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

export default PostEditor
