import { useEffect, useState } from "react"
import {
  Button,
  DataTable,
  DataTablePaginationState,
  Select,
  StatusBadge,
  Text,
  createDataTableColumnHelper,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/client"
import { LOCALES, localeName } from "../../lib/options"
import PostEditor from "./post-editor"
import {
  BLOG_QUERY_KEYS,
  BlogPost,
  POST_STATE_BADGE,
  PostsResponse,
  postState,
} from "./types"

const PAGE_SIZE = 15

const columnHelper = createDataTableColumnHelper<BlogPost>()

const PostsPanel = () => {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [locale, setLocale] = useState("all")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [editor, setEditor] = useState<{ open: boolean; postId: string | null }>(
    { open: false, postId: null }
  )

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  // A new search or filter starts again from the first page.
  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [search, status, locale])

  const { data, isLoading } = useQuery({
    queryKey: [BLOG_QUERY_KEYS.posts, limit, offset, search, status, locale],
    queryFn: () =>
      sdk.client.fetch<PostsResponse>("/admin/blog/posts", {
        query: {
          limit,
          offset,
          q: search || undefined,
          status: status === "all" ? undefined : status,
          locale: locale === "all" ? undefined : locale,
        },
      }),
    placeholderData: (previous: PostsResponse | undefined) => previous,
  })

  const table = useDataTable({
    data: data?.posts || [],
    columns: [
      columnHelper.accessor("title", {
        header: "Title",
        cell: ({ row }) => (
          <div className="flex flex-col py-1">
            <Text size="small" leading="compact" weight="plus">
              {row.original.title}
            </Text>
            <Text
              size="small"
              leading="compact"
              className="text-ui-fg-subtle"
            >
              /blog/{row.original.handle}
            </Text>
          </div>
        ),
      }),
      columnHelper.accessor("locale", {
        header: "Written in",
        cell: ({ getValue }) => localeName(getValue()),
      }),
      columnHelper.display({
        id: "translations",
        header: "Translated",
        cell: ({ row }) =>
          row.original.translated_locales?.map(localeName).join(", ") || "—",
      }),
      columnHelper.display({
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const badge = POST_STATE_BADGE[postState(row.original)]

          return <StatusBadge color={badge.color}>{badge.label}</StatusBadge>
        },
      }),
      columnHelper.display({
        id: "categories",
        header: "Categories",
        cell: ({ row }) =>
          row.original.categories?.map((category) => category.name).join(", ") ||
          "—",
      }),
      columnHelper.accessor("published_at", {
        header: "Published",
        cell: ({ getValue }) => {
          const value = getValue()

          return value ? new Date(value).toLocaleDateString() : "—"
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => (
          <Button
            size="small"
            variant="secondary"
            onClick={() => setEditor({ open: true, postId: row.original.id })}
          >
            Edit
          </Button>
        ),
      }),
    ],
    getRowId: (post) => post.id,
    rowCount: data?.count || 0,
    isLoading,
    search: {
      state: search,
      onSearchChange: setSearch,
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <div className="p-6">
      <DataTable instance={table}>
        <DataTable.Toolbar>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DataTable.Search placeholder="Search posts..." />
              <Select value={status} onValueChange={setStatus}>
                <Select.Trigger className="w-[130px]">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All statuses</Select.Item>
                  <Select.Item value="published">Published</Select.Item>
                  <Select.Item value="draft">Draft</Select.Item>
                </Select.Content>
              </Select>
              <Select value={locale} onValueChange={setLocale}>
                <Select.Trigger className="w-[170px]">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">Any language</Select.Item>
                  {LOCALES.map((option) => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <Button
              size="small"
              onClick={() => setEditor({ open: true, postId: null })}
            >
              New post
            </Button>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      <PostEditor
        open={editor.open}
        postId={editor.postId}
        onClose={() => setEditor({ open: false, postId: null })}
      />
    </div>
  )
}

export default PostsPanel
