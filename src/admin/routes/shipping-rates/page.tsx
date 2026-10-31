import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { Trash, TruckFast } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"
import {
  blankTable,
  RATES_QUERY_KEY,
  RateTable,
  RateTableEditor,
} from "../../components/shipping-rates/rate-table-editor"

type Currency = {
  id: string
  currency_code: string
  rate: number
}

type RatesResponse = {
  tables: RateTable[]
  currencies: Currency[]
}

type Quote = {
  zone: { id: string; name: string }
  zone_match: "postcode" | "fallback"
  /** Euro. */
  amount: number
  currency_code: string
  /** In `currency_code`. */
  charge: number
  breakdown: {
    tier_id: string
    label: string
    quantity: number
    price: number
    times: number
  }[]
}

const keyOf = (table: { shipping_class: string; country_code: string }) =>
  `${table.shipping_class}/${table.country_code}`

const ExchangeRates = ({ currencies }: { currencies: Currency[] }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [code, setCode] = useState("")
  const [rate, setRate] = useState("")
  // Rates being edited, by currency id; the saved rate shows otherwise.
  const [edits, setEdits] = useState<Record<string, string>>({})

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [RATES_QUERY_KEY] })

  const save = useMutation({
    mutationFn: (input: { currency_code: string; rate: number }) =>
      sdk.client.fetch("/admin/shipping-rates/currencies", {
        method: "POST",
        body: input,
      }),
    onSuccess: (_result, input) => {
      refresh()
      setEdits({})
      if (input.currency_code === code.trim().toLowerCase()) {
        setCode("")
        setRate("")
      }
      toast.success("Exchange rate saved")
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not save the exchange rate")
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/shipping-rates/currencies/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      refresh()
      toast.success("Exchange rate deleted")
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not delete the exchange rate")
    },
  })

  const confirmDelete = async (currency: Currency) => {
    const confirmed = await prompt({
      title: `Delete the ${currency.currency_code.toUpperCase()} rate?`,
      description: `Carts in ${currency.currency_code.toUpperCase()} cannot be given a delivery price until a rate is saved again.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (confirmed) {
      remove.mutate(currency.id)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-1 px-6 py-4">
        <Heading level="h2">Exchange rates</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          The rates above are in euro. A cart in another currency pays the
          euro price times the rate here, for example 400 makes a 50 euro
          delivery 20,000 forints. Euro needs no rate.
        </Text>
      </div>
      <div className="flex flex-col gap-3 px-6 py-4">
        {currencies.length === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            No exchange rates yet. Only carts in euro can be given a delivery
            price.
          </Text>
        )}
        {currencies.map((currency) => {
          const text = edits[currency.id] ?? String(currency.rate)
          const changed = text !== String(currency.rate)
          return (
            <div
              key={currency.id}
              className="flex flex-wrap items-center gap-3"
              data-testid={`rate-${currency.currency_code}`}
            >
              <Badge>{currency.currency_code.toUpperCase()}</Badge>
              <Text size="small">1 EUR =</Text>
              <Input
                size="small"
                className="w-32"
                type="number"
                min={0}
                step="0.0001"
                aria-label={`${currency.currency_code.toUpperCase()} per euro`}
                value={text}
                onChange={(e) =>
                  setEdits((state) => ({
                    ...state,
                    [currency.id]: e.target.value,
                  }))
                }
              />
              <Text size="small">{currency.currency_code.toUpperCase()}</Text>
              <Button
                size="small"
                disabled={!changed}
                isLoading={save.isPending}
                onClick={() =>
                  save.mutate({
                    currency_code: currency.currency_code,
                    rate: Number(text),
                  })
                }
              >
                Save
              </Button>
              <IconButton
                size="small"
                variant="transparent"
                aria-label={`Delete the ${currency.currency_code.toUpperCase()} rate`}
                onClick={() => confirmDelete(currency)}
              >
                <Trash />
              </IconButton>
            </div>
          )
        })}

        <div className="flex flex-wrap items-end gap-3 pt-2">
          <div className="flex flex-col gap-1">
            <Label size="small">Currency</Label>
            <Input
              size="small"
              className="w-24"
              placeholder="huf"
              maxLength={3}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Units per 1 euro</Label>
            <Input
              size="small"
              className="w-32"
              type="number"
              min={0}
              step="0.0001"
              placeholder="400"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <Button
            size="small"
            variant="secondary"
            disabled={!code.trim() || !rate.trim()}
            isLoading={save.isPending}
            onClick={() =>
              save.mutate({
                currency_code: code.trim().toLowerCase(),
                rate: Number(rate),
              })
            }
          >
            Add rate
          </Button>
        </div>
      </div>
    </Container>
  )
}

const TryADelivery = ({ tables }: { tables: RateTable[] }) => {
  const [shippingClass, setShippingClass] = useState("pallet")
  const [country, setCountry] = useState("at")
  const [postcode, setPostcode] = useState("")
  const [units, setUnits] = useState("1")
  const [currency, setCurrency] = useState("eur")

  const quote = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ quote: Quote }>("/admin/shipping-rates/quote", {
        query: {
          shipping_class: shippingClass.trim().toLowerCase(),
          country_code: country.trim().toLowerCase(),
          postcode: postcode.trim() || undefined,
          units: Number(units),
          currency_code: currency.trim().toLowerCase() || "eur",
        },
      }),
  })

  const classes = [...new Set(tables.map((table) => table.shipping_class))]
  const result = quote.data?.quote

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-1 px-6 py-4">
        <Heading level="h2">Try a delivery</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Prices a delivery from the rates above exactly as the checkout does,
          and shows which zone the postcode lands in. Saved rates only.
        </Text>
      </div>
      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label size="small">Shipping class</Label>
            <Input
              size="small"
              className="w-32"
              list="rate-classes"
              value={shippingClass}
              onChange={(e) => setShippingClass(e.target.value)}
            />
            <datalist id="rate-classes">
              {classes.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Country</Label>
            <Input
              size="small"
              className="w-20"
              maxLength={2}
              placeholder="at"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Postcode</Label>
            <Input
              size="small"
              className="w-28"
              placeholder="8010"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Units</Label>
            <Input
              size="small"
              className="w-20"
              type="number"
              min={1}
              step={1}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Currency</Label>
            <Input
              size="small"
              className="w-20"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
          <Button
            size="small"
            variant="secondary"
            isLoading={quote.isPending}
            onClick={() => quote.mutate()}
          >
            Calculate
          </Button>
        </div>

        {quote.isError && (
          <Text size="small" className="text-ui-fg-error" data-testid="quote-error">
            {(quote.error as any)?.message || "Could not work out the price"}
          </Text>
        )}

        {result && (
          <div className="flex flex-col gap-2" data-testid="quote-result">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="green">{result.zone.name}</Badge>
              <Text size="small" className="text-ui-fg-subtle">
                {result.zone_match === "postcode"
                  ? "the postcode is listed in this zone"
                  : "the postcode is not listed, so this zone takes it"}
              </Text>
            </div>
            <Text weight="plus">
              {result.charge.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              {result.currency_code.toUpperCase()}
              {result.currency_code !== "eur" && (
                <span className="text-ui-fg-subtle font-normal">
                  {" "}
                  ({result.amount} EUR)
                </span>
              )}
            </Text>
            <ul className="text-ui-fg-subtle text-sm">
              {result.breakdown.map((line) => (
                <li key={line.tier_id}>
                  {line.times} x {line.label || `${line.quantity} units`} at{" "}
                  {line.price} EUR
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Container>
  )
}

const ShippingRatesRoute = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: [RATES_QUERY_KEY],
    queryFn: () => sdk.client.fetch<RatesResponse>("/admin/shipping-rates"),
  })

  // Tables started here and not saved yet, by class and country.
  const [drafts, setDrafts] = useState<RateTable[]>([])
  const [newClass, setNewClass] = useState("pallet")
  const [newCountry, setNewCountry] = useState("")

  const saved = data?.tables ?? []
  const taken = new Set([...saved, ...drafts].map(keyOf))

  const addTable = () => {
    const shippingClass = newClass.trim().toLowerCase()
    const countryCode = newCountry.trim().toLowerCase()
    if (!/^[a-z][a-z0-9_-]*$/.test(shippingClass) || !/^[a-z]{2}$/.test(countryCode)) {
      toast.error(
        "The class is a short name such as pallet; the country is a two-letter code such as at."
      )
      return
    }
    if (taken.has(`${shippingClass}/${countryCode}`)) {
      toast.error("There are already rates for that class and country.")
      return
    }
    setDrafts((list) => [...list, blankTable(shippingClass, countryCode)])
    setNewCountry("")
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="flex flex-col gap-1 px-6 py-4">
          <div className="flex items-center gap-2">
            <Heading level="h1">Shipping rates</Heading>
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            What the checkout charges for delivery. Each table is the rates of
            one shipping class (pallet or carton products) to one country.
            Prices are in euro, without VAT.
          </Text>
        </div>
        <div className="flex flex-col gap-2 px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Reading a table: a customer's postcode picks the zone (the longest
            match among the postcodes listed, otherwise the zone marked "All
            other postcodes"). A shipment with its own row costs what the row
            says. A bigger one is built from the largest rows: with rows for 1
            and 2 pallets, 3 pallets are the 2-pallet row plus the 1-pallet
            row. Several rows switched on for the same size: the cheapest is
            used. A fixed price per unit is one zone and one row of 1 unit.
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            A product gets its class under Products, in its shipping profile;
            a class is delivered through a shipping option set to Calculated
            under Settings, Locations and Shipping. A cart with products of
            both classes pays both.
          </Text>
        </div>
      </Container>

      {isLoading && (
        <Container>
          <Text size="small" className="text-ui-fg-subtle">
            Loading the rates...
          </Text>
        </Container>
      )}
      {isError && (
        <Container>
          <Text size="small" className="text-ui-fg-error">
            The rates could not be loaded. Reload the page to try again.
          </Text>
        </Container>
      )}

      {saved.map((table) => (
        <RateTableEditor key={table.id} table={table} />
      ))}
      {drafts.map((table) => (
        <RateTableEditor
          key={keyOf(table)}
          table={table}
          onSettled={() =>
            setDrafts((list) =>
              list.filter((draft) => keyOf(draft) !== keyOf(table))
            )
          }
        />
      ))}

      <Container className="p-0">
        <div className="flex flex-wrap items-end gap-3 px-6 py-4">
          <div className="flex flex-col gap-1">
            <Label size="small">Shipping class</Label>
            <Input
              size="small"
              className="w-32"
              list="rate-classes-new"
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
            />
            <datalist id="rate-classes-new">
              {[...new Set(saved.map((table) => table.shipping_class))].map(
                (name) => (
                  <option key={name} value={name} />
                )
              )}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Country</Label>
            <Input
              size="small"
              className="w-20"
              maxLength={2}
              placeholder="at"
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
            />
          </div>
          <Button size="small" variant="secondary" onClick={addTable}>
            Add rates for a country
          </Button>
        </div>
      </Container>

      <ExchangeRates currencies={data?.currencies ?? []} />
      <TryADelivery tables={saved} />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Shipping rates",
  icon: TruckFast,
})

export default ShippingRatesRoute
