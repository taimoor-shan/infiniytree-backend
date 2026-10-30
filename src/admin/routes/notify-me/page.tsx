import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  DataTable,
  DataTablePaginationState,
  Heading,
  IconButton,
  Text,
  createDataTableColumnHelper,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"

type NotifyMeRequest = {
  id: string
  email: string
  product_id: string
  /** Empty when the visitor signed up for the product as a whole. */
  variant_id: string | null
  product_title: string | null
  variant_title: string | null
  product_url: string | null
  created_at: string
}

type NotifyMeResponse = {
  requests: NotifyMeRequest[]
  count: number
  limit: number
  offset: number
}

const QUERY_KEY = "notify-me-requests"

const columnHelper = createDataTableColumnHelper<NotifyMeRequest>()

const NotifyMeRoute = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [searchValue, setSearchValue] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY, limit, offset, searchValue],
    queryFn: () =>
      sdk.client.fetch<NotifyMeResponse>("/admin/notify-me", {
        query: { limit, offset, q: searchValue || undefined },
      }),
    placeholderData: (prev: NotifyMeResponse | undefined) => prev,
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/notify-me/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      toast.success("Signup deleted")
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not delete the signup")
    },
  })

  const confirmDelete = async (request: NotifyMeRequest) => {
    const confirmed = await prompt({
      title: "Delete this signup?",
      description: `${request.email} will not be on the list for ${
        request.product_title || "this product"
      } any more.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      remove.mutate(request.id)
    }
  }

  const columns = [
    columnHelper.accessor("email", {
      header: "Email",
      cell: ({ getValue }) => (
        <a
          href={`mailto:${getValue()}`}
          className="text-ui-fg-interactive hover:underline"
        >
          {getValue()}
        </a>
      ),
    }),
    columnHelper.accessor("product_title", {
      header: "Product",
      cell: ({ row }) => (
        <a
          href={`/app/products/${row.original.product_id}`}
          className="text-ui-fg-interactive hover:underline"
        >
          {row.original.product_title || row.original.product_id}
        </a>
      ),
    }),
    columnHelper.accessor("variant_title", {
      header: "Variant",
      cell: ({ getValue }) => getValue() || "Whole product",
    }),
    columnHelper.accessor("created_at", {
      header: "Signed up",
      cell: ({ getValue }) => new Date(getValue()).toLocaleString(),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <IconButton
          size="small"
          variant="transparent"
          aria-label={`Delete the signup of ${row.original.email}`}
          onClick={() => confirmDelete(row.original)}
        >
          <Trash />
        </IconButton>
      ),
    }),
  ]

  const table = useDataTable({
    data: data?.requests || [],
    columns,
    getRowId: (request) => request.id,
    rowCount: data?.count || 0,
    isLoading,
    search: {
      state: searchValue,
      onSearchChange: (value) => {
        setSearchValue(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-1 px-6 py-4">
        <Heading level="h1">Notify me</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Everyone who asked to be emailed when a product is available. The shop
          also gets an email for each new signup.
        </Text>
      </div>
      <div className="p-6">
        <DataTable instance={table}>
          <DataTable.Toolbar>
            <div className="flex gap-2">
              <DataTable.Search placeholder="Search email or product..." />
            </div>
          </DataTable.Toolbar>
          <DataTable.Table
            emptyState={{
              empty: {
                heading: "No signups yet",
                description:
                  "Signups appear here when a visitor uses Notify me on an out-of-stock product.",
              },
              filtered: {
                heading: "No matching signups",
                description: "Try a different email or product name.",
              },
            }}
          />
          <DataTable.Pagination />
        </DataTable>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Notify me",
})

export default NotifyMeRoute
