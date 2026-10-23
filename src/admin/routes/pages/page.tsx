import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  DataTable,
  DataTablePaginationState,
  Heading,
  createDataTableColumnHelper,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import PageEditor from "../../components/pages/page-editor"
import {
  PAGE_QUERY_KEYS,
  Page,
  PagesResponse,
} from "../../components/pages/types"
import { sdk } from "../../lib/client"
import { localeName } from "../../lib/options"

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

const PagesRoute = () => {
  const [searchValue, setSearchValue] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })
  // Pages are written and edited in a full-screen editor, new or saved.
  const [editor, setEditor] = useState<{ open: boolean; pageId: string | null }>(
    { open: false, pageId: null }
  )

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [PAGE_QUERY_KEYS.pages, limit, offset, searchValue],
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
            onClick={() => setEditor({ open: true, pageId: row.original.id })}
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

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h1">Pages</Heading>
          <Button
            size="small"
            onClick={() => setEditor({ open: true, pageId: null })}
          >
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

      <PageEditor
        open={editor.open}
        pageId={editor.pageId}
        onClose={() => setEditor({ open: false, pageId: null })}
      />
    </>
  )
}

export const config = defineRouteConfig({
  label: "Pages",
})

export default PagesRoute
