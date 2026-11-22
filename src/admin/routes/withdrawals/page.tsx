import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { ArrowUturnLeft } from "@medusajs/icons"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"

type Withdrawal = {
  id: string
  status: "new" | "handled"
  name: string
  email: string
  order_number: string
  order_id: string | null
  order_display_id: number | null
  items: string | null
  message: string | null
  locale: string | null
  created_at: string
}

type WithdrawalsResponse = { withdrawals: Withdrawal[]; count: number }

const QUERY_KEY = ["withdrawals"]
const PAGE_SIZE = 100

/**
 * Declarations of withdrawal sent with the storefront's "Withdraw from
 * contract" function. The customer has already had a confirmation of receipt
 * by email; mark one handled once the return and refund are arranged.
 * Declarations are a legal record, so there is no delete.
 */
const WithdrawalsRoute = () => {
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...QUERY_KEY, offset],
    queryFn: () =>
      sdk.client.fetch<WithdrawalsResponse>("/admin/withdrawals", {
        query: { limit: PAGE_SIZE, offset },
      }),
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "new" | "handled" }) =>
      sdk.client.fetch(`/admin/withdrawals/${id}`, {
        method: "POST",
        body: { status },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = data?.withdrawals ?? []

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading>Withdrawals</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Sent with the website's "Withdraw from contract" function. The customer
          was emailed a confirmation of receipt. A declaration whose order number
          and email match no order is marked "check by hand".
        </Text>
      </div>
      {isLoading ? (
        <Text className="px-6 py-4">Loading…</Text>
      ) : isError ? (
        <div className="flex items-center gap-3 px-6 py-4">
          <Text className="text-ui-fg-error">The withdrawals could not be loaded.</Text>
          <Button size="small" variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : !rows.length ? (
        <Text className="px-6 py-4 text-ui-fg-subtle">No withdrawals yet.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Received</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell>Covers</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((w) => (
              <Table.Row key={w.id}>
                <Table.Cell>{new Date(w.created_at).toLocaleString()}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col">
                    <span>{w.name}</span>
                    <a
                      className="text-ui-fg-interactive hover:underline"
                      href={`mailto:${w.email}`}
                    >
                      {w.email}
                    </a>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {w.order_id ? (
                    <a
                      className="text-ui-fg-interactive hover:underline"
                      href={`/app/orders/${w.order_id}`}
                    >
                      #{w.order_display_id}
                    </a>
                  ) : (
                    <span>
                      {w.order_number}{" "}
                      <Badge size="2xsmall" color="orange">
                        check by hand
                      </Badge>
                    </span>
                  )}
                </Table.Cell>
                <Table.Cell className="max-w-[280px] whitespace-normal">
                  {w.items || "Whole order"}
                  {w.message && (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {w.message}
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Badge color={w.status === "handled" ? "green" : "blue"}>
                    {w.status === "handled" ? "Handled" : "New"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="small"
                    variant="secondary"
                    isLoading={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate({
                        id: w.id,
                        status: w.status === "handled" ? "new" : "handled",
                      })
                    }
                  >
                    {w.status === "handled" ? "Mark as new" : "Mark as handled"}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
      {data && data.count > PAGE_SIZE && (
        <div className="flex items-center justify-between px-6 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, data.count)} of {data.count}
          </Text>
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Newer
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={offset + PAGE_SIZE >= data.count}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Older
            </Button>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Withdrawals",
  icon: ArrowUturnLeft,
})

export default WithdrawalsRoute
