import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { EnvelopeSolid } from "@medusajs/icons"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/client"

type Subscriber = {
  id: string
  email: string
  status: "pending" | "confirmed" | "unsubscribed"
  locale: string | null
  created_at: string
  confirmed_at: string | null
  unsubscribed_at: string | null
}

const STATUS: Record<Subscriber["status"], { label: string; color: "green" | "orange" | "grey" }> = {
  confirmed: { label: "Confirmed", color: "green" },
  pending: { label: "Waiting for confirmation", color: "orange" },
  unsubscribed: { label: "Unsubscribed", color: "grey" },
}

/**
 * Newsletter sign-ups from the storefront footer. Only confirmed addresses
 * (the visitor clicked the link in the confirmation email) may be written to;
 * "Download confirmed (CSV)" gives them, with each address's unsubscribe
 * token for the link every newsletter needs.
 */
const NewsletterRoute = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: () =>
      sdk.client.fetch<{ subscribers: Subscriber[]; count: number }>("/admin/newsletter"),
  })

  const download = async () => {
    // Same backend address as the SDK, which may not be this page's origin.
    const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "")
    const response = await fetch(`${base}/admin/newsletter?format=csv`, {
      credentials: "include",
    }).catch(() => null)
    if (!response?.ok) {
      toast.error("The download did not work. Please try again.")
      return
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "newsletter-subscribers.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const rows = data?.subscribers ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Newsletter</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Sign-ups with double opt-in. Write only to confirmed addresses.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={download}>
          Download confirmed (CSV)
        </Button>
      </div>
      {isLoading ? (
        <Text className="px-6 py-4">Loading…</Text>
      ) : isError ? (
        <div className="flex items-center gap-3 px-6 py-4">
          <Text className="text-ui-fg-error">The sign-ups could not be loaded.</Text>
          <Button size="small" variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : !rows.length ? (
        <Text className="px-6 py-4 text-ui-fg-subtle">No sign-ups yet.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Language</Table.HeaderCell>
              <Table.HeaderCell>Signed up</Table.HeaderCell>
              <Table.HeaderCell>Confirmed</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((s) => (
              <Table.Row key={s.id}>
                <Table.Cell>{s.email}</Table.Cell>
                <Table.Cell>
                  <Badge size="2xsmall" color={STATUS[s.status].color}>
                    {STATUS[s.status].label}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{s.locale ?? "en"}</Table.Cell>
                <Table.Cell>{new Date(s.created_at).toLocaleString()}</Table.Cell>
                <Table.Cell>
                  {s.confirmed_at ? new Date(s.confirmed_at).toLocaleString() : "-"}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
      {data && data.count > rows.length && (
        <Text size="small" className="px-6 py-3 text-ui-fg-subtle">
          Showing the newest {rows.length} of {data.count}. The CSV has every confirmed address.
        </Text>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Newsletter",
  icon: EnvelopeSolid,
})

export default NewsletterRoute
