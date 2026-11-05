import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  DataTable,
  DataTablePaginationState,
  Drawer,
  Heading,
  IconButton,
  Text,
  createDataTableColumnHelper,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { MapPin, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"

type DeliveryRequestItem = {
  title: string
  variant_title: string | null
  sku: string | null
  quantity: number
  unit_price: number
  product_id: string | null
}

type DeliveryRequest = {
  id: string
  status: "new" | "handled"
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  vat_number: string | null
  phone: string | null
  address_1: string | null
  address_2: string | null
  postal_code: string | null
  city: string | null
  province: string | null
  country_code: string
  message: string | null
  locale: string | null
  currency_code: string | null
  item_subtotal: number | null
  items: DeliveryRequestItem[] | null
  created_at: string
}

type DeliveryRequestsResponse = {
  requests: DeliveryRequest[]
  count: number
  limit: number
  offset: number
}

const QUERY_KEY = "delivery-requests"

const columnHelper = createDataTableColumnHelper<DeliveryRequest>()

const countryName = (code: string) => {
  const upper = (code || "").toUpperCase()
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(upper) || upper
  } catch {
    return upper
  }
}

const money = (amount: number | null, currency: string | null) => {
  if (amount == null) return ""
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "eur").toUpperCase(),
    }).format(amount)
  } catch {
    return `${amount} ${currency ?? ""}`
  }
}

const personName = (r: DeliveryRequest) =>
  [r.first_name, r.last_name].filter(Boolean).join(" ")

const Details = ({ request }: { request: DeliveryRequest }) => (
  <div className="flex flex-col gap-6">
    <section className="flex flex-col gap-1">
      <Text size="small" weight="plus">
        Deliver to
      </Text>
      {[
        request.company,
        personName(request),
        request.address_1,
        request.address_2,
        [request.postal_code, request.city].filter(Boolean).join(" "),
        request.province,
        countryName(request.country_code),
      ]
        .filter(Boolean)
        .map((line, i) => (
          <Text key={i} size="small">
            {line}
          </Text>
        ))}
    </section>
    <section className="flex flex-col gap-1">
      <Text size="small" weight="plus">
        Contact
      </Text>
      <Text size="small">
        <a
          className="text-ui-fg-interactive hover:underline"
          href={`mailto:${request.email}`}
        >
          {request.email}
        </a>
      </Text>
      {request.phone && (
        <Text size="small">
          <a
            className="text-ui-fg-interactive hover:underline"
            href={`tel:${request.phone.replace(/\s/g, "")}`}
          >
            {request.phone}
          </a>
        </Text>
      )}
      {request.vat_number && (
        <Text size="small">VAT number: {request.vat_number}</Text>
      )}
      {request.locale && <Text size="small">Language: {request.locale}</Text>}
    </section>
    <section className="flex flex-col gap-2">
      <Text size="small" weight="plus">
        Products
      </Text>
      {(request.items ?? []).map((item, i) => (
        <div key={i} className="flex justify-between gap-4">
          <Text size="small">
            {item.quantity} ×{" "}
            {item.product_id ? (
              <a
                className="text-ui-fg-interactive hover:underline"
                href={`/app/products/${item.product_id}`}
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
            {item.variant_title ? ` (${item.variant_title})` : ""}
          </Text>
          <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">
            {money(item.unit_price, request.currency_code)}
          </Text>
        </div>
      ))}
      {request.item_subtotal != null && (
        <Text size="small" className="text-ui-fg-subtle">
          Subtotal, net and without delivery:{" "}
          {money(request.item_subtotal, request.currency_code)}
        </Text>
      )}
    </section>
    {request.message && (
      <section className="flex flex-col gap-1">
        <Text size="small" weight="plus">
          Message
        </Text>
        <Text size="small" className="whitespace-pre-wrap">
          {request.message}
        </Text>
      </section>
    )}
  </div>
)

const DeliveryRequestsRoute = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [open, setOpen] = useState<DeliveryRequest | null>(null)
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
      sdk.client.fetch<DeliveryRequestsResponse>("/admin/delivery-requests", {
        query: { limit, offset, q: searchValue || undefined },
      }),
    placeholderData: (prev: DeliveryRequestsResponse | undefined) => prev,
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "new" | "handled" }) =>
      sdk.client.fetch<{ request: DeliveryRequest }>(
        `/admin/delivery-requests/${id}`,
        { method: "POST", body: { status } }
      ),
    onSuccess: ({ request }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      setOpen((current) =>
        current?.id === request.id ? { ...current, ...request } : current
      )
      toast.success(
        request.status === "handled" ? "Marked as handled" : "Marked as new"
      )
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not update the request")
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/delivery-requests/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      setOpen(null)
      toast.success("Request deleted")
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not delete the request")
    },
  })

  const confirmDelete = async (request: DeliveryRequest) => {
    const confirmed = await prompt({
      title: "Delete this request?",
      description: `The delivery request of ${request.email} to ${countryName(
        request.country_code
      )} will be removed from the list.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      remove.mutate(request.id)
    }
  }

  const columns = [
    columnHelper.accessor("created_at", {
      header: "Received",
      cell: ({ getValue }) => new Date(getValue()).toLocaleString(),
    }),
    columnHelper.accessor("country_code", {
      header: "Country",
      cell: ({ row }) =>
        `${countryName(row.original.country_code)}${
          row.original.city ? `, ${row.original.city}` : ""
        }`,
    }),
    columnHelper.accessor("email", {
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>
            {row.original.company || personName(row.original) || "—"}
          </span>
          <span className="text-ui-fg-subtle">{row.original.email}</span>
        </div>
      ),
    }),
    columnHelper.accessor("items", {
      header: "Products",
      cell: ({ row }) => {
        const items = row.original.items ?? []
        const units = items.reduce((sum, i) => sum + (i.quantity || 0), 0)
        return `${units} item${units === 1 ? "" : "s"} · ${money(
          row.original.item_subtotal,
          row.original.currency_code
        )}`
      },
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: ({ getValue }) =>
        getValue() === "handled" ? (
          <Badge color="green" size="2xsmall">
            Handled
          </Badge>
        ) : (
          <Badge color="orange" size="2xsmall">
            New
          </Badge>
        ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <IconButton
          size="small"
          variant="transparent"
          aria-label={`Delete the request of ${row.original.email}`}
          onClick={(e) => {
            e.stopPropagation()
            confirmDelete(row.original)
          }}
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
    // Medusa UI passes the table row (despite its type), whose data is
    // `original`; the fallback keeps it working if that is ever fixed.
    onRowClick: (_event, row) =>
      setOpen((row as unknown as { original?: DeliveryRequest }).original ?? row),
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
        <Heading level="h1">Delivery requests</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Customers who asked for a delivery quote to a European country the
          checkout does not deliver to yet. Nothing was ordered or paid: reply
          with a price (the shop also gets an email for each request, and
          replying to it answers the customer), then mark the request handled.
        </Text>
      </div>
      <div className="p-6">
        <DataTable instance={table}>
          <DataTable.Toolbar>
            <div className="flex gap-2">
              <DataTable.Search placeholder="Search email, company, city or country..." />
            </div>
          </DataTable.Toolbar>
          <DataTable.Table
            emptyState={{
              empty: {
                heading: "No delivery requests yet",
                description:
                  "Requests appear here when a customer chooses a country under “Delivery on request” at checkout.",
              },
              filtered: {
                heading: "No matching requests",
                description: "Try a different search.",
              },
            }}
          />
          <DataTable.Pagination />
        </DataTable>
      </div>

      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              Delivery to {open ? countryName(open.country_code) : ""}
            </Drawer.Title>
            <Drawer.Description>
              {open ? new Date(open.created_at).toLocaleString() : ""}
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            {open && <Details request={open} />}
          </Drawer.Body>
          <Drawer.Footer>
            {open && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => confirmDelete(open)}
                  disabled={remove.isPending}
                >
                  Delete
                </Button>
                <Button
                  onClick={() =>
                    setStatus.mutate({
                      id: open.id,
                      status: open.status === "handled" ? "new" : "handled",
                    })
                  }
                  isLoading={setStatus.isPending}
                >
                  {open.status === "handled"
                    ? "Mark as new"
                    : "Mark as handled"}
                </Button>
              </>
            )}
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Delivery requests",
  icon: MapPin,
})

export default DeliveryRequestsRoute
