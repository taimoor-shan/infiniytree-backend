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
import { sdk } from "../../lib/client"

type Page = {
  id: string
  title: string
  slug: string
  content?: string | null
  excerpt?: string | null
  featured_image?: string | null
  seo_title?: string | null
  seo_description?: string | null
  status: "draft" | "published"
  is_public: boolean
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
  content: string
  excerpt: string
  featured_image: string
  seo_title: string
  seo_description: string
  status: "draft" | "published"
  is_public: boolean
}

const initialFormState: PageFormState = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  featured_image: "",
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
      content: page.content || "",
      excerpt: page.excerpt || "",
      featured_image: page.featured_image || "",
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
              <PageForm formState={formState} setFormState={setFormState} />
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
              <PageForm formState={formState} setFormState={setFormState} />
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
}: {
  formState: PageFormState
  setFormState: (state: PageFormState) => void
}) => {
  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" weight="plus">
          Title
        </Text>
        <Input
          value={formState.title}
          onChange={(e) =>
            setFormState({ ...formState, title: e.target.value })
          }
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
