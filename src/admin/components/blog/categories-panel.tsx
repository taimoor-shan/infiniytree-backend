import { useEffect, useState } from "react"
import {
  Button,
  Drawer,
  FocusModal,
  Input,
  Select,
  Table,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"
import { LOCALES, localeName } from "../../lib/options"
import { slugify } from "../../lib/slugify"
import TranslationsBox from "../translations/translations-box"
import { TRANSLATION_QUERY_KEY } from "../translations/types"
import { Field } from "./fields"
import { BLOG_QUERY_KEYS, BlogCategory, CategoriesResponse } from "./types"

type CategoryFormState = {
  name: string
  handle: string
  locale: string
  description: string
  seo_title: string
  seo_description: string
}

const EMPTY_FORM: CategoryFormState = {
  name: "",
  handle: "",
  locale: "en",
  description: "",
  seo_title: "",
  seo_description: "",
}

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type CategoryEditorProps = {
  mode: "create" | "edit"
  category: BlogCategory | null
  open: boolean
  onClose: () => void
}

/** New categories open full screen, existing ones in a drawer. */
const CategoryEditor = ({
  mode,
  category,
  open,
  onClose,
}: CategoryEditorProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM)
  const [handleTouched, setHandleTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    if (mode === "edit" && category) {
      setForm({
        name: category.name || "",
        handle: category.handle || "",
        locale: category.locale || "en",
        description: category.description || "",
        seo_title: category.seo_title || "",
        seo_description: category.seo_description || "",
      })
      setHandleTouched(true)
    } else {
      setForm(EMPTY_FORM)
      setHandleTouched(false)
    }
  }, [open, mode, category])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [BLOG_QUERY_KEYS.categories] })
    // The post list shows category names.
    queryClient.invalidateQueries({ queryKey: [BLOG_QUERY_KEYS.posts] })
    // The Translations box shows the original: refresh it too.
    queryClient.invalidateQueries({
      queryKey: [TRANSLATION_QUERY_KEY, "blog_category", category?.id],
    })
  }

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      sdk.client.fetch(
        mode === "edit"
          ? `/admin/blog/categories/${category?.id}`
          : "/admin/blog/categories",
        { method: "POST", body: payload }
      ),
    onSuccess: () => {
      refresh()
      toast.success(mode === "edit" ? "Category updated" : "Category created")
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to save the category")
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/blog/categories/${category?.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      refresh()
      toast.success("Category deleted")
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete the category")
    },
  })

  const busy = save.isPending || remove.isPending
  const handleValid = HANDLE_PATTERN.test(form.handle)
  const canSave = form.name.trim().length > 0 && handleValid

  const set = <K extends keyof CategoryFormState>(
    key: K,
    value: CategoryFormState[K]
  ) => setForm((current) => ({ ...current, [key]: value }))

  const submit = () =>
    save.mutate({
      name: form.name.trim(),
      handle: form.handle,
      locale: form.locale,
      description: form.description.trim() || null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
    })

  const onDelete = async () => {
    const confirmed = await prompt({
      title: "Delete this category?",
      description: `"${form.name}" is removed from its posts. The posts themselves stay.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      remove.mutate()
    }
  }

  const fields = (
    <div className="flex flex-col gap-y-6">
      <Field label="Name">
        <Input
          value={form.name}
          placeholder="Plant care"
          onChange={(e) => {
            const name = e.target.value
            setForm((current) => ({
              ...current,
              name,
              ...(handleTouched ? {} : { handle: slugify(name) }),
            }))
          }}
        />
      </Field>
      <Field
        label="Handle"
        hint={
          form.handle && !handleValid
            ? "Use lowercase letters, numbers and single hyphens only."
            : "The category page is /blog/category/<handle>. The handle is the same in every language."
        }
      >
        <Input
          value={form.handle}
          aria-invalid={!!form.handle && !handleValid}
          onChange={(e) => {
            setHandleTouched(true)
            set("handle", e.target.value)
          }}
        />
      </Field>
      <Field
        label="Language of the text"
        hint="The language you write the name and description in. Add the other languages under Translations."
      >
        <Select value={form.locale} onValueChange={(v) => set("locale", v)}>
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
      <Field
        label="Description"
        hint="Shown at the top of the category page. A few sentences help it rank."
      >
        <Textarea
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <Field label="SEO title" hint="Leave empty to use the name.">
        <Input
          value={form.seo_title}
          onChange={(e) => set("seo_title", e.target.value)}
        />
      </Field>
      <Field label="SEO description" hint="Leave empty to use the description.">
        <Textarea
          rows={3}
          value={form.seo_description}
          onChange={(e) => set("seo_description", e.target.value)}
        />
      </Field>
    </div>
  )

  if (mode === "create") {
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
            <FocusModal.Title className="sr-only">New category</FocusModal.Title>
            <FocusModal.Description className="sr-only">
              Add a category for blog posts.
            </FocusModal.Description>
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary">
                    Cancel
                  </Button>
                </FocusModal.Close>
                <Button
                  size="small"
                  onClick={submit}
                  isLoading={save.isPending}
                  disabled={!canSave || busy}
                >
                  Save
                </Button>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="flex-1 overflow-auto p-6">
              <div className="mx-auto flex max-w-xl flex-col gap-y-8">
                {fields}
                <TranslationsBox
                  reference="blog_category"
                  recordId={null}
                  listKey={BLOG_QUERY_KEYS.categories}
                />
              </div>
            </FocusModal.Body>
          </div>
        </FocusModal.Content>
      </FocusModal>
    )
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit category</Drawer.Title>
          <Drawer.Description className="sr-only">
            Change this blog category.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-auto p-6">
          <div className="flex flex-col gap-y-8">
            {fields}
            <TranslationsBox
              reference="blog_category"
              recordId={category?.id ?? null}
              listKey={BLOG_QUERY_KEYS.categories}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex w-full items-center justify-between">
            <Button
              size="small"
              variant="danger"
              onClick={onDelete}
              disabled={busy}
            >
              Delete
            </Button>
            <div className="flex items-center gap-x-2">
              <Drawer.Close asChild>
                <Button size="small" variant="secondary">
                  Cancel
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                onClick={submit}
                isLoading={save.isPending}
                disabled={!canSave || busy}
              >
                Save
              </Button>
            </div>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

const CategoriesPanel = () => {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<BlogCategory | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: [BLOG_QUERY_KEYS.categories],
    queryFn: () =>
      sdk.client.fetch<CategoriesResponse>("/admin/blog/categories"),
  })

  const categories = data?.categories ?? []

  return (
    <div className="flex flex-col gap-y-4 p-6">
      <div className="flex items-center justify-between">
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Categories group posts into topics. Each one gets its own page at
          /blog/category/&lt;handle&gt;.
        </Text>
        <Button size="small" onClick={() => setCreating(true)}>
          New category
        </Button>
      </div>

      {isLoading ? (
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Loading...
        </Text>
      ) : categories.length === 0 ? (
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          No categories yet.
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Handle</Table.HeaderCell>
              <Table.HeaderCell>Written in</Table.HeaderCell>
              <Table.HeaderCell>Translated</Table.HeaderCell>
              <Table.HeaderCell>Description</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {categories.map((category) => (
              <Table.Row key={category.id}>
                <Table.Cell>{category.name}</Table.Cell>
                <Table.Cell>{category.handle}</Table.Cell>
                <Table.Cell>{localeName(category.locale)}</Table.Cell>
                <Table.Cell>
                  {category.translated_locales?.map(localeName).join(", ") || "—"}
                </Table.Cell>
                <Table.Cell className="max-w-[320px] truncate">
                  {category.description || "—"}
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => setEditing(category)}
                  >
                    Edit
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <CategoryEditor
        mode="create"
        category={null}
        open={creating}
        onClose={() => setCreating(false)}
      />
      <CategoryEditor
        mode="edit"
        category={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

export default CategoriesPanel
