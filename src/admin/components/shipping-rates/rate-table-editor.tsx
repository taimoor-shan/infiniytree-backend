import { useEffect, useMemo, useState } from "react"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Switch,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { Plus, Trash, XMark } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"

export type RateZone = {
  id: string
  name: string
  postcodes: string
  is_fallback: boolean
}

export type RateTier = {
  id: string
  label: string
  quantity: number
  active: boolean
  prices: Record<string, number | null>
}

export type RateTable = {
  /** Empty for a table that has not been saved yet. */
  id: string
  shipping_class: string
  country_code: string
  zones: RateZone[]
  tiers: RateTier[]
}

/** The numbers are text while they are typed, so "80." and "" can be typed. */
type DraftTier = {
  id: string
  label: string
  quantity: string
  active: boolean
  prices: Record<string, string>
}

type Draft = {
  zones: RateZone[]
  tiers: DraftTier[]
}

export const RATES_QUERY_KEY = "shipping-rates"

const newId = (prefix: string) =>
  `${prefix}${Math.random().toString(36).slice(2, 8)}`

const toDraft = (table: RateTable): Draft => ({
  zones: table.zones.map((zone) => ({ ...zone })),
  tiers: table.tiers.map((tier) => ({
    id: tier.id,
    label: tier.label,
    quantity: String(tier.quantity),
    active: tier.active,
    prices: Object.fromEntries(
      table.zones.map((zone) => [zone.id, String(tier.prices[zone.id] ?? "")])
    ),
  })),
})

const toPayload = (table: RateTable, draft: Draft) => ({
  shipping_class: table.shipping_class,
  country_code: table.country_code,
  zones: draft.zones,
  tiers: draft.tiers.map((tier) => ({
    id: tier.id,
    label: tier.label,
    quantity: Number(tier.quantity),
    active: tier.active,
    prices: Object.fromEntries(
      draft.zones.map((zone) => {
        const text = (tier.prices[zone.id] ?? "").trim()
        return [zone.id, text === "" ? null : Number(text)]
      })
    ),
  })),
})

/** A table with one zone for the whole country and one price per unit, to start from. */
export const blankTable = (
  shippingClass: string,
  countryCode: string
): RateTable => ({
  id: "",
  shipping_class: shippingClass,
  country_code: countryCode,
  zones: [
    {
      id: "all",
      name: `All of ${countryCode.toUpperCase()}`,
      postcodes: "",
      is_fallback: true,
    },
  ],
  tiers: [
    {
      id: "one",
      label: `1 ${shippingClass}`,
      quantity: 1,
      active: true,
      prices: { all: null },
    },
  ],
})

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)

const cell = "px-2 py-1.5 align-top"
const headCell = `${cell} text-left font-normal`

type Props = {
  table: RateTable
  /** Called once an unsaved table is saved or dropped, so the page forgets it. */
  onSettled?: () => void
}

/**
 * One carrier's tariff, edited like the sheet it came from: zones across,
 * shipment sizes down, a price in each cell. Saving replaces the table.
 */
export const RateTableEditor = ({ table, onSettled }: Props) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const serverKey = JSON.stringify(table)
  const [draft, setDraft] = useState<Draft>(() => toDraft(table))
  useEffect(() => {
    setDraft(toDraft(table))
    // Only a change in what is saved resets the form, not a refetch of the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  const isNew = !table.id
  const dirty = useMemo(
    () => isNew || JSON.stringify(draft) !== JSON.stringify(toDraft(table)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, serverKey]
  )

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/shipping-rates/tables", {
        method: "POST",
        body: toPayload(table, draft),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RATES_QUERY_KEY] })
      toast.success("Rates saved")
      onSettled?.()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not save the rates")
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/shipping-rates/tables/${table.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RATES_QUERY_KEY] })
      toast.success("Rates deleted")
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not delete the rates")
    },
  })

  const confirmDelete = async () => {
    if (isNew) {
      onSettled?.()
      return
    }
    const confirmed = await prompt({
      title: "Delete these rates?",
      description: `A ${table.shipping_class} delivery to ${table.country_code.toUpperCase()} cannot be priced until rates are saved for it again, and customers there will not be able to check out with such products.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (confirmed) {
      remove.mutate()
    }
  }

  const setZone = (id: string, patch: Partial<RateZone>) =>
    setDraft((d) => ({
      ...d,
      zones: d.zones.map((zone) =>
        zone.id === id
          ? { ...zone, ...patch }
          : // Only one zone takes the postcodes nobody lists.
            patch.is_fallback
            ? { ...zone, is_fallback: false }
            : zone
      ),
    }))

  const addZone = () =>
    setDraft((d) => ({
      ...d,
      zones: [
        ...d.zones,
        {
          id: newId("z"),
          name: `Zone ${d.zones.length + 1}`,
          postcodes: "",
          is_fallback: false,
        },
      ],
    }))

  const removeZone = (id: string) =>
    setDraft((d) => ({
      zones: d.zones.filter((zone) => zone.id !== id),
      tiers: d.tiers.map((tier) => {
        const { [id]: _gone, ...prices } = tier.prices
        return { ...tier, prices }
      }),
    }))

  const setTier = (id: string, patch: Partial<DraftTier>) =>
    setDraft((d) => ({
      ...d,
      tiers: d.tiers.map((tier) =>
        tier.id === id ? { ...tier, ...patch } : tier
      ),
    }))

  const setPrice = (tierId: string, zoneId: string, value: string) =>
    setDraft((d) => ({
      ...d,
      tiers: d.tiers.map((tier) =>
        tier.id === tierId
          ? { ...tier, prices: { ...tier.prices, [zoneId]: value } }
          : tier
      ),
    }))

  const addTier = () =>
    setDraft((d) => ({
      ...d,
      tiers: [
        ...d.tiers,
        {
          id: newId("t"),
          label: "",
          quantity: String(
            Math.max(0, ...d.tiers.map((tier) => Number(tier.quantity) || 0)) + 1
          ),
          active: true,
          prices: {},
        },
      ],
    }))

  const removeTier = (id: string) =>
    setDraft((d) => ({ ...d, tiers: d.tiers.filter((tier) => tier.id !== id) }))

  const heading = `${titleCase(table.shipping_class)} to ${table.country_code.toUpperCase()}`

  return (
    <Container className="divide-y p-0" data-testid={`rates-${table.shipping_class}-${table.country_code}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-2">
          <Heading level="h2">{heading}</Heading>
          {isNew && <Badge color="orange">Not saved yet</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="secondary"
            onClick={confirmDelete}
            disabled={remove.isPending || save.isPending}
          >
            {isNew ? "Discard" : "Delete"}
          </Button>
          <Button
            size="small"
            onClick={() => save.mutate()}
            disabled={!dirty}
            isLoading={save.isPending}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-4">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${headCell} w-14`}>Use</th>
              <th className={headCell}>Shipment</th>
              <th className={`${headCell} w-20`}>Units</th>
              {draft.zones.map((zone) => (
                <th key={zone.id} className={`${headCell} min-w-[9rem]`}>
                  <div className="flex items-center gap-1">
                    <Input
                      size="small"
                      aria-label={`Name of ${zone.name}`}
                      value={zone.name}
                      onChange={(e) => setZone(zone.id, { name: e.target.value })}
                    />
                    <IconButton
                      size="small"
                      variant="transparent"
                      aria-label={`Remove ${zone.name}`}
                      onClick={() => removeZone(zone.id)}
                      disabled={draft.zones.length < 2}
                    >
                      <XMark />
                    </IconButton>
                  </div>
                </th>
              ))}
              <th className={`${headCell} w-24`}>
                <Button size="small" variant="transparent" onClick={addZone}>
                  <Plus /> Zone
                </Button>
              </th>
            </tr>
            <tr className="border-b border-ui-border-base">
              <td className={cell} colSpan={3}>
                <Text size="small" className="text-ui-fg-subtle">
                  Postcodes the zone covers: starts or ranges, such as 8, 90,
                  1000-1999. The longest match wins.
                </Text>
              </td>
              {draft.zones.map((zone) => (
                <td key={zone.id} className={cell}>
                  <Input
                    size="small"
                    aria-label={`Postcodes of ${zone.name}`}
                    placeholder="e.g. 8, 90, 1000-1999"
                    value={zone.postcodes}
                    onChange={(e) =>
                      setZone(zone.id, { postcodes: e.target.value })
                    }
                  />
                  <label className="mt-2 flex cursor-pointer items-center gap-2">
                    <Switch
                      size="small"
                      aria-label={`${zone.name} takes all other postcodes`}
                      checked={zone.is_fallback}
                      onCheckedChange={(checked) =>
                        setZone(zone.id, { is_fallback: checked })
                      }
                    />
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      All other postcodes
                    </Text>
                  </label>
                </td>
              ))}
              <td />
            </tr>
          </thead>
          <tbody>
            {draft.tiers.map((tier) => (
              <tr key={tier.id} className="border-b border-ui-border-base last:border-0">
                <td className={cell}>
                  <Switch
                    size="small"
                    aria-label={`Use the row ${tier.label || tier.quantity}`}
                    checked={tier.active}
                    onCheckedChange={(checked) =>
                      setTier(tier.id, { active: checked })
                    }
                  />
                </td>
                <td className={cell}>
                  <Input
                    size="small"
                    aria-label="Shipment"
                    placeholder="e.g. 1 pallet / 50 kg, 120 x 80 x 170 cm"
                    value={tier.label}
                    onChange={(e) => setTier(tier.id, { label: e.target.value })}
                  />
                </td>
                <td className={cell}>
                  <Input
                    size="small"
                    type="number"
                    min={1}
                    step={1}
                    aria-label={`Units covered by ${tier.label || "this row"}`}
                    value={tier.quantity}
                    onChange={(e) =>
                      setTier(tier.id, { quantity: e.target.value })
                    }
                  />
                </td>
                {draft.zones.map((zone) => (
                  <td key={zone.id} className={cell}>
                    <Input
                      size="small"
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={`Price of ${tier.label || "this row"} in ${zone.name}`}
                      placeholder="EUR"
                      value={tier.prices[zone.id] ?? ""}
                      onChange={(e) => setPrice(tier.id, zone.id, e.target.value)}
                    />
                  </td>
                ))}
                <td className={cell}>
                  <IconButton
                    size="small"
                    variant="transparent"
                    aria-label={`Remove the row ${tier.label || tier.quantity}`}
                    onClick={() => removeTier(tier.id)}
                    disabled={draft.tiers.length < 2}
                  >
                    <Trash />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2">
          <Button size="small" variant="transparent" onClick={addTier}>
            <Plus /> Row
          </Button>
        </div>
      </div>
    </Container>
  )
}
