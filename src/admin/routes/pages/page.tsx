import { useEffect, useMemo, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  DataTable,
  DataTablePaginationState,
  Drawer,
  FocusModal,
  Heading,
  Input,
  Select,
  Switch,
  Text,
  Textarea,
  createDataTableColumnHelper,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import ImageUpload from "../../components/image-upload"
import RichTextEditor from "../../components/rich-text-editor"
import TranslationsBox from "../../components/translations/translations-box"
import { sdk } from "../../lib/client"
import { PAGE_TEMPLATES, localeName } from "../../lib/options"
import { slugify } from "../../lib/slugify"

type Page = {
  id: string
  title: string
  slug: string
  locale?: string
  content?: string | null
  excerpt?: string | null
  featured_image?: string | null
  hero_video_url?: string | null
  template?: string
  seo_title?: string | null
  seo_description?: string | null
  status: "draft" | "published"
  is_public: boolean
  /** Languages the page has been translated into (list responses only). */
  translated_locales?: string[]
  created_at: string
  updated_at: string
}

type PagesResponse = {
  pages: Page[]
  count: number
  limit: number
  offset: number
}

type PageResponse = {
  page: Page
}

const columnHelper = createDataTableColumnHelper<Page>()

const columns = [
  columnHelper.accessor("title", {
    header: "Title",
  }),
  columnHelper.accessor("slug", {
    header: "Slug",
  }),
  columnHelper.accessor("locale", {
    header: "Written in",
    cell: ({ getValue }) => localeName(getValue() ?? "en"),
  }),
  columnHelper.display({
    id: "translations",
    header: "Translated",
    cell: ({ row }) =>
      row.original.translated_locales?.map(localeName).join(", ") || "—",
  }),
  columnHelper.accessor("status", {
    header: "Status",
  }),
  columnHelper.accessor("is_public", {
    header: "Public",
    cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
  }),
  columnHelper.accessor("updated_at", {
    header: "Updated",
    cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
  }),
]

type PageFormState = {
  title: string
  slug: string
  locale: string
  content: string
  excerpt: string
  featured_image: string
  hero_video_url: string
  template: string
  seo_title: string
  seo_description: string
  status: "draft" | "published"
  is_public: boolean
}

const initialFormState: PageFormState = {
  title: "",
  slug: "",
  locale: "en",
  content: "",
  excerpt: "",
  featured_image: "",
  hero_video_url: "",
  template: "default",
  seo_title: "",
  seo_description: "",
  status: "draft",
  is_public: false,
}

const PagesRoute = () => {
  const queryClient = useQueryClient()
  const [searchValue, setSearchValue] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<PageFormState>(initialFormState)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["pages", limit, offset, searchValue],
    queryFn: () =>
      sdk.client.fetch<PagesResponse>("/admin/pages", {
        query: {
          limit,
          offset,
          q: searchValue || undefined,
        },
      }),
    placeholderData: (prev: PagesResponse | undefined) => prev,
  })

  const { data: editData, isLoading: isLoadingEdit } = useQuery({
    queryKey: ["page", editingId],
    queryFn: () =>
      sdk.client.fetch<PageResponse>(`/admin/pages/${editingId}`),
    enabled: !!editingId && editOpen,
  })

  useEffect(() => {
    if (!editData?.page) {
      return
    }
    const page = editData.page
    setFormState({
      title: page.title || "",
      slug: page.slug || "",
      locale: page.locale || "en",
      content: page.content || "",
      excerpt: page.excerpt || "",
      featured_image: page.featured_image || "",
      hero_video_url: page.hero_video_url || "",
      template: page.template || "default",
      seo_title: page.seo_title || "",
      seo_description: page.seo_description || "",
      status: page.status || "draft",
      is_public: page.is_public || false,
    })
  }, [editData])
  useEffect(() => {
    if (createOpen) {
      setFormState(initialFormState)
    }
  }, [createOpen])

  const createPage = useMutation({
    mutationFn: (payload: PageFormState) =>
      sdk.client.fetch<PageResponse>("/admin/pages", {
        method: "POST",
        body: {
          ...payload,
          featured_image: payload.featured_image || null,
          hero_video_url: payload.hero_video_url || null,
          excerpt: payload.excerpt || null,
          seo_title: payload.seo_title || null,
          seo_description: payload.seo_description || null,
          content: payload.content || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] })
      toast.success("Page created")
      setCreateOpen(false)
      setFormState(initialFormState)
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create page")
    },
  })

  const updatePage = useMutation({
    mutationFn: (payload: PageFormState) =>
      sdk.client.fetch<PageResponse>(`/admin/pages/${editingId}`, {
        method: "POST",
        body: {
          ...payload,
          featured_image: payload.featured_image || null,
          hero_video_url: payload.hero_video_url || null,
          excerpt: payload.excerpt || null,
          seo_title: payload.seo_title || null,
          seo_description: payload.seo_description || null,
          content: payload.content || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] })
      if (editingId) {
        queryClient.invalidateQueries({ queryKey: ["page", editingId] })
      }
      toast.success("Page updated")
      setEditOpen(false)
      setEditingId(null)
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update page")
    },
  })

  const table = useDataTable({
    data: data?.pages || [],
    columns: [
      ...columns,
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => (
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              setEditingId(row.original.id)
              setEditOpen(true)
            }}
          >
            Edit
          </Button>
        ),
      }),
    ],
    getRowId: (page) => page.id,
    rowCount: data?.count || 0,
    isLoading,
    search: {
      state: searchValue,
      onSearchChange: setSearchValue,
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  const formIsValid = useMemo(() => {
    return formState.title.trim().length > 0 && formState.slug.trim().length > 0
  }, [formState])

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h1">Pages</Heading>
          <Button size="small" onClick={() => setCreateOpen(true)}>
            Create page
          </Button>
        </div>
        <div className="p-6">
          <DataTable instance={table}>
            <DataTable.Toolbar>
              <div className="flex gap-2">
                <DataTable.Search placeholder="Search pages..." />
              </div>
            </DataTable.Toolbar>
            <DataTable.Table />
            <DataTable.Pagination />
          </DataTable>
        </div>
      </Container>

      <FocusModal open={createOpen} onOpenChange={setCreateOpen}>
        <FocusModal.Content>
          <div className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary">
                    Cancel
                  </Button>
                </FocusModal.Close>
                <Button
                  size="small"
                  onClick={() => createPage.mutate(formState)}
                  isLoading={createPage.isPending}
                  disabled={!formIsValid}
                >
                  Save
                </Button>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="flex-1 overflow-auto p-6">
              <PageForm
                formState={formState}
                setFormState={setFormState}
                isNew
              />
            </FocusModal.Body>
          </div>
        </FocusModal.Content>
      </FocusModal>

      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit page</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex-1 overflow-auto p-6">
            {isLoadingEdit ? (
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                Loading...
              </Text>
            ) : (
              <div className="flex flex-col gap-y-8">
                <PageForm formState={formState} setFormState={setFormState} />
                <TranslationsBox
                  reference="page"
                  recordId={editingId}
                  listKey="pages"
                />
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button size="small" variant="secondary">
                  Cancel
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                onClick={() => updatePage.mutate(formState)}
                isLoading={updatePage.isPending}
                disabled={!formIsValid || !editingId}
              >
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

const PageForm = ({
  formState,
  setFormState,
  isNew = false,
}: {
  formState: PageFormState
  setFormState: (state: PageFormState) => void
  /** A page being created: its slug follows the title until it is edited. */
  isNew?: boolean
}) => {
  const template = PAGE_TEMPLATES.find(
    (option) => option.value === formState.template
  )

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Title
        </Text>
        <Input
          value={formState.title}
          onChange={(e) => {
            const title = e.target.value
            const slugFollowsTitle =
              isNew &&
              (formState.slug === "" ||
                formState.slug === slugify(formState.title))

            setFormState({
              ...formState,
              title,
              ...(slugFollowsTitle ? { slug: slugify(title) } : {}),
            })
          }}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Slug
        </Text>
        <Input
          value={formState.slug}
          onChange={(e) =>
            setFormState({ ...formState, slug: e.target.value })
          }
        />
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          The page is published at /{formState.slug || "your-slug"}. Use a slash
          for a nested address, for example guides/plant-care. Pages built into
          the storefront (about, contact, the policies) keep their own address.
        </Text>
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Language of the text
        </Text>
        <Select
          value={formState.locale}
          onValueChange={(value) =>
            setFormState({ ...formState, locale: value })
          }
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="en">English (en)</Select.Item>
            <Select.Item value="de-AT">German - Austria (de-AT)</Select.Item>
            <Select.Item value="de-DE">German - Germany (de-DE)</Select.Item>
            <Select.Item value="hu-HU">Hungarian (hu-HU)</Select.Item>
          </Select.Content>
        </Select>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          The language you write this page in. Add the other languages with
          Translations (shown when you edit a saved page): there is no need for
          a second copy of the page with the same slug.
        </Text>
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Template
        </Text>
        <Select
          value={formState.template}
          onValueChange={(value) =>
            setFormState({ ...formState, template: value })
          }
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
        {template?.description && (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {template.description}
          </Text>
        )}
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Featured image
        </Text>
        <ImageUpload
          value={formState.featured_image}
          onChange={(value) =>
            setFormState({ ...formState, featured_image: value })
          }
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Hero video
        </Text>
        <ImageUpload
          kind="video"
          value={formState.hero_video_url}
          onChange={(value) =>
            setFormState({ ...formState, hero_video_url: value })
          }
        />
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Optional. Plays muted in a loop on desktop. The featured image is used
          as the poster and shown alone on mobile. MP4 or WebM, up to 20 MB.
        </Text>
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Excerpt
        </Text>
        <Textarea
          value={formState.excerpt}
          onChange={(e) =>
            setFormState({ ...formState, excerpt: e.target.value })
          }
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Content
        </Text>
        <RichTextEditor
          value={formState.content}
          onChange={(value) => setFormState({ ...formState, content: value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-y-2">
          <Text size="small" leading="compact" weight="plus">
            Status
          </Text>
          <Select
            value={formState.status}
            onValueChange={(value) =>
              setFormState({
                ...formState,
                status: value as "draft" | "published",
              })
            }
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="draft">Draft</Select.Item>
              <Select.Item value="published">Published</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-y-2">
          <Text size="small" leading="compact" weight="plus">
            Public
          </Text>
          <div className="flex items-center gap-x-2">
            <Switch
              checked={formState.is_public}
              onCheckedChange={(checked) =>
                setFormState({ ...formState, is_public: checked })
              }
            />
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Visible on storefront
            </Text>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          SEO title
        </Text>
        <Input
          value={formState.seo_title}
          onChange={(e) =>
            setFormState({ ...formState, seo_title: e.target.value })
          }
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          SEO description
        </Text>
        <Textarea
          value={formState.seo_description}
          onChange={(e) =>
            setFormState({ ...formState, seo_description: e.target.value })
          }
        />
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Pages",
})

export default PagesRoute
