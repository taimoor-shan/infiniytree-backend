import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import { setupShipping } from "../../src/scripts/setup-shipping"

jest.setTimeout(180 * 1000)

type Cart = Record<string, any>

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let storeHeaders: Record<string, string>
    let salesChannelId: string
    let europeRegionId: string
    let hungaryRegionId: string
    let variants: Record<string, string>

    const readTables = async () =>
      (await api.get("/admin/shipping-rates", { headers })).data

    beforeEach(async () => {
      const container = getContainer()
      const admin = await createAdminHeaders(container)
      headers = admin.headers

      const [store] = await container.resolve(Modules.STORE).listStores()
      await updateStoresWorkflow(container).run({
        input: {
          selector: { id: store.id },
          update: {
            supported_currencies: [
              { currency_code: "eur", is_default: true },
              { currency_code: "huf" },
            ],
          },
        },
      })

      let [salesChannel] = await container
        .resolve(Modules.SALES_CHANNEL)
        .listSalesChannels({ name: "Default Sales Channel" })
      if (!salesChannel) {
        ;[salesChannel] = (
          await createSalesChannelsWorkflow(container).run({
            input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
          })
        ).result
      }
      salesChannelId = salesChannel.id

      const { result: regions } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: "Europe",
              currency_code: "eur",
              countries: ["at", "de"],
              payment_providers: ["pp_system_default"],
            },
            {
              name: "Hungary",
              currency_code: "huf",
              countries: ["hu"],
              payment_providers: ["pp_system_default"],
            },
          ],
        },
      })
      europeRegionId = regions.find((region) => region.name === "Europe")!.id
      hungaryRegionId = regions.find((region) => region.name === "Hungary")!.id

      // The shop's delivery set: a Hungary zone and a Europe (Austria, Germany) zone.
      const {
        result: [location],
      } = await createStockLocationsWorkflow(container).run({
        input: { locations: [{ name: "Warehouse" }] },
      })
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: location.id, add: [salesChannel.id] },
      })
      const fulfillment = container.resolve(Modules.FULFILLMENT)
      const set = await fulfillment.createFulfillmentSets({
        name: "Delivery",
        type: "shipping",
        service_zones: [
          {
            name: "Hungary",
            geo_zones: [{ country_code: "hu", type: "country" }],
          },
          {
            name: "Europe",
            geo_zones: [
              { country_code: "de", type: "country" },
              { country_code: "at", type: "country" },
            ],
          },
        ],
      })
      const link = container.resolve(ContainerRegistrationKeys.LINK)
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
      })
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
      })

      const key = await container.resolve(Modules.API_KEY).createApiKeys({
        title: "storefront",
        type: "publishable",
        created_by: admin.user.id,
      })
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: key.id, add: [salesChannel.id] },
      })
      storeHeaders = { "x-publishable-api-key": key.token }

      // The shop's range: two pallet pieces, two carton pieces, and one the
      // setup does not know the class of.
      const {
        result: products,
      } = await createProductsWorkflow(container).run({
        input: {
          products: [
            "Bonsai Tree",
            "Cherry Blossom",
            "Rose Royal",
            "Magnolia",
            "Garden Gnome",
          ].map((title) => ({
            title,
            status: "published" as const,
            sales_channels: [{ id: salesChannel.id }],
            options: [{ title: "Size", values: ["One"] }],
            variants: [
              {
                title: "One",
                options: { Size: "One" },
                manage_inventory: false,
                prices: [
                  { currency_code: "eur", amount: 100 },
                  { currency_code: "huf", amount: 40000 },
                ],
              },
            ],
          })),
        },
      })
      variants = Object.fromEntries(
        products.map((product) => [product.title, product.variants![0].id])
      )

      await setupShipping(container)
    })

    const newCart = async (
      country: string,
      postalCode: string,
      items: Record<string, number>
    ): Promise<Cart> => {
      const regionId = country === "hu" ? hungaryRegionId : europeRegionId
      const { data } = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          sales_channel_id: salesChannelId,
          email: "buyer@example.com",
          shipping_address: {
            first_name: "Eva",
            last_name: "Buyer",
            address_1: "Main street 1",
            city: "Town",
            country_code: country,
            postal_code: postalCode,
          },
          items: Object.entries(items).map(([title, quantity]) => ({
            variant_id: variants[title],
            quantity,
          })),
        },
        { headers: storeHeaders }
      )
      return data.cart
    }

    const listOptions = async (cartId: string) =>
      (
        await api.get(`/store/shipping-options?cart_id=${cartId}`, {
          headers: storeHeaders,
        })
      ).data.shipping_options as any[]

    const optionNamed = (options: any[], name: string) => {
      const option = options.find((o) => o.name === name)
      expect(option).toBeDefined()
      return option
    }

    const calculate = async (cartId: string, optionId: string) =>
      (
        await api.post(
          `/store/shipping-options/${optionId}/calculate`,
          { cart_id: cartId },
          { headers: storeHeaders }
        )
      ).data.shipping_option

    const addMethod = async (cartId: string, optionId: string) =>
      (
        await api.post(
          `/store/carts/${cartId}/shipping-methods`,
          { option_id: optionId },
          { headers: storeHeaders }
        )
      ).data.cart as Cart

    const CART_FIELDS = [
      "currency_code",
      "*items",
      "*shipping_methods",
      "shipping_subtotal",
      "shipping_total",
      "total",
    ].join(",")

    const getCart = async (cartId: string): Promise<Cart> =>
      (
        await api.get(`/store/carts/${cartId}?fields=${CART_FIELDS}`, {
          headers: storeHeaders,
        })
      ).data.cart

    /** Opens the payment step the way the storefront does, with the system provider. */
    const startPayment = async (cartId: string) => {
      const {
        data: { payment_collection },
      } = await api.post(
        "/store/payment-collections",
        { cart_id: cartId },
        { headers: storeHeaders }
      )
      await api.post(
        `/store/payment-collections/${payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        { headers: storeHeaders }
      )
    }

    /** Picks the pallet and carton delivery the cart needs and returns the cart. */
    const chooseDeliveries = async (cart: Cart): Promise<Cart> => {
      const options = await listOptions(cart.id)
      let current = cart
      for (const name of ["Pallet delivery", "Carton delivery"]) {
        const wanted = options.find((o) => o.name === name)
        if (wanted) {
          current = await addMethod(cart.id, wanted.id)
        }
      }
      return getCart(cart.id)
    }

    describe("the setup", () => {
      it("makes the two shipping classes and puts the known products in them", async () => {
        const profiles = (
          await api.get("/admin/shipping-profiles", { headers })
        ).data.shipping_profiles
        expect(
          profiles.map((p: any) => [p.name, p.type]).sort()
        ).toEqual([
          ["Carton products", "carton"],
          ["Pallet products", "pallet"],
        ])

        const classOf = async (title: string) =>
          (
            await api.get(
              `/admin/products?title=${encodeURIComponent(title)}&fields=title,*shipping_profile`,
              { headers }
            )
          ).data.products[0].shipping_profile?.type ?? null

        expect(await classOf("Bonsai Tree")).toBe("pallet")
        expect(await classOf("Cherry Blossom")).toBe("pallet")
        expect(await classOf("Rose Royal")).toBe("carton")
        expect(await classOf("Magnolia")).toBe("carton")
        // The class of this one is not known, so it keeps what it has.
        expect(await classOf("Garden Gnome")).toBeNull()
      })

      it("saves the starting rates and the forint rate", async () => {
        const { tables, currencies } = await readTables()

        expect(
          tables.map((t: any) => `${t.shipping_class}/${t.country_code}`).sort()
        ).toEqual([
          "carton/at",
          "carton/de",
          "carton/hu",
          "pallet/at",
          "pallet/de",
          "pallet/hu",
        ])
        expect(currencies).toEqual([
          expect.objectContaining({ currency_code: "huf", rate: 400 }),
        ])
      })

      it("adds a calculated pallet and carton delivery to both zones", async () => {
        const { data: options } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "shipping_option",
            fields: [
              "name",
              "price_type",
              "data",
              "service_zone.name",
              "shipping_profile.type",
            ],
            filters: { provider_id: "tariff_rates" },
          })

        expect(
          options
            .map(
              (o: any) =>
                `${o.name} / ${o.service_zone.name} / ${o.shipping_profile.type} / ${o.price_type} / ${o.data?.id}`
            )
            .sort()
        ).toEqual([
          "Carton delivery / Europe / carton / calculated / carton",
          "Carton delivery / Hungary / carton / calculated / carton",
          "Pallet delivery / Europe / pallet / calculated / pallet",
          "Pallet delivery / Hungary / pallet / calculated / pallet",
        ])
      })

      it("offers the pallet and carton delivery as fulfillment options", async () => {
        const { data } = await api.get(
          "/admin/fulfillment-providers/tariff_rates/options",
          { headers }
        )
        expect(data.fulfillment_options.map((o: any) => o.id)).toEqual([
          "carton",
          "pallet",
        ])
      })

      it("is safe to run again, and keeps rates that were edited", async () => {
        const edited = (await readTables()).tables.find(
          (t: any) => t.shipping_class === "pallet" && t.country_code === "at"
        )
        edited.tiers[0].prices.z1 = 99
        await api.post(
          "/admin/shipping-rates/tables",
          {
            shipping_class: edited.shipping_class,
            country_code: edited.country_code,
            zones: edited.zones,
            tiers: edited.tiers,
          },
          { headers }
        )

        const second = await setupShipping(getContainer())

        expect(second.rate_tables_created).toEqual([])
        expect(second.currency_rates_created).toEqual([])
        expect(second.shipping_options_created).toEqual([])
        expect(second.products_assigned).toEqual([])

        const again = (await readTables()).tables.find(
          (t: any) => t.shipping_class === "pallet" && t.country_code === "at"
        )
        expect(again.tiers[0].prices.z1).toBe(99)
      })
    })

    describe("what the checkout charges", () => {
      it("2 Rose Royal: 100 euro", async () => {
        const cart = await chooseDeliveries(
          await newCart("de", "10115", { "Rose Royal": 2 })
        )

        expect(cart.shipping_methods).toHaveLength(1)
        expect(cart.shipping_methods[0].name).toBe("Carton delivery")
        expect(Number(cart.shipping_methods[0].amount)).toBe(100)
        expect(Number(cart.shipping_subtotal)).toBe(100)
      })

      it("1 Bonsai + 2 Magnolia in Austria: the 1-pallet price + 100", async () => {
        const cart = await chooseDeliveries(
          await newCart("at", "8010", { "Bonsai Tree": 1, Magnolia: 2 })
        )

        const amounts = Object.fromEntries(
          cart.shipping_methods.map((m: any) => [m.name, Number(m.amount)])
        )
        expect(amounts).toEqual({
          "Pallet delivery": 80,
          "Carton delivery": 100,
        })
        expect(Number(cart.shipping_subtotal)).toBe(180)
      })

      it("1 Bonsai + 2 Magnolia in Germany: the 1-pallet price + 100", async () => {
        const cart = await chooseDeliveries(
          await newCart("de", "90402", { "Bonsai Tree": 1, Magnolia: 2 })
        )
        expect(Number(cart.shipping_subtotal)).toBe(185 + 100)
      })

      it("2 Cherry Blossom + 1 Rose Royal in Hungary: 100 + 50, charged in forints", async () => {
        const cart = await chooseDeliveries(
          await newCart("hu", "1011", { "Cherry Blossom": 2, "Rose Royal": 1 })
        )

        expect(cart.currency_code).toBe("huf")
        const amounts = Object.fromEntries(
          cart.shipping_methods.map((m: any) => [m.name, Number(m.amount)])
        )
        // 100 euro and 50 euro at 400 forints to the euro
        expect(amounts).toEqual({
          "Pallet delivery": 40000,
          "Carton delivery": 20000,
        })
        expect(Number(cart.shipping_subtotal)).toBe(60000)
      })

      it("lists the same prices the cart is then charged, in the cart's currency", async () => {
        // The storefront shows the customer what the calculate endpoint says
        // before the delivery is added to the cart; Medusa's endpoint does not
        // hand the provider the cart's currency, so the two could differ.
        const cart = await newCart("hu", "1011", {
          "Cherry Blossom": 2,
          "Rose Royal": 1,
        })
        const options = await listOptions(cart.id)

        const listed = {
          "Pallet delivery": Number(
            (await calculate(cart.id, optionNamed(options, "Pallet delivery").id))
              .amount
          ),
          "Carton delivery": Number(
            (await calculate(cart.id, optionNamed(options, "Carton delivery").id))
              .amount
          ),
        }
        expect(listed).toEqual({
          "Pallet delivery": 40000,
          "Carton delivery": 20000,
        })

        const charged = await chooseDeliveries(cart)
        expect(
          Object.fromEntries(
            charged.shipping_methods.map((m: any) => [m.name, Number(m.amount)])
          )
        ).toEqual(listed)
      })

      it("follows the postcode to its zone and the pallets to their row", async () => {
        const price = async (postcode: string, pallets: number) => {
          const cart = await newCart("at", postcode, { "Bonsai Tree": pallets })
          const options = await listOptions(cart.id)
          return Number(
            (await calculate(cart.id, optionNamed(options, "Pallet delivery").id))
              .amount
          )
        }

        expect(await price("8010", 1)).toBe(80)
        expect(await price("1010", 1)).toBe(85)
        expect(await price("3100", 1)).toBe(90)
        expect(await price("6020", 1)).toBe(100)
        expect(await price("1010", 2)).toBe(180)
        expect(await price("8010", 3)).toBe(150 + 80)
      })

      it("charges the net price, with tax on top", async () => {
        const cart = await chooseDeliveries(
          await newCart("at", "8010", { "Bonsai Tree": 1 })
        )
        expect(cart.shipping_methods[0].is_tax_inclusive).toBe(false)
      })

      it("prices again when the cart changes", async () => {
        const cart = await chooseDeliveries(
          await newCart("de", "90402", { "Bonsai Tree": 1 })
        )
        expect(Number(cart.shipping_subtotal)).toBe(185)

        const item = cart.items[0]
        await api.post(
          `/store/carts/${cart.id}/line-items/${item.id}`,
          { quantity: 2 },
          { headers: storeHeaders }
        )
        expect(Number((await getCart(cart.id)).shipping_subtotal)).toBe(300)

        // A new postcode is a new zone
        await api.post(
          `/store/carts/${cart.id}`,
          {
            shipping_address: {
              first_name: "Eva",
              last_name: "Buyer",
              address_1: "Main street 1",
              city: "Town",
              country_code: "de",
              postal_code: "16515",
            },
          },
          { headers: storeHeaders }
        )
        expect(Number((await getCart(cart.id)).shipping_subtotal)).toBe(345)
      })

      it("cannot be completed without a delivery for every class", async () => {
        const cart = await newCart("at", "8010", {
          "Bonsai Tree": 1,
          Magnolia: 1,
        })
        const options = await listOptions(cart.id)
        await addMethod(cart.id, optionNamed(options, "Pallet delivery").id)
        await startPayment(cart.id)

        const complete = await api
          .post(`/store/carts/${cart.id}/complete`, {}, { headers: storeHeaders })
          .catch((error) => error.response)
        expect(complete.status).toBeGreaterThanOrEqual(400)
        expect(complete.data.message).toContain(
          "require shipping profiles that are not satisfied"
        )
      })

      it("places the order with both deliveries charged", async () => {
        const cart = await chooseDeliveries(
          await newCart("at", "8010", { "Bonsai Tree": 1, Magnolia: 2 })
        )
        await startPayment(cart.id)

        const { data } = await api.post(
          `/store/carts/${cart.id}/complete?fields=*shipping_methods,shipping_subtotal,shipping_total,total`,
          {},
          { headers: storeHeaders }
        )

        expect(data.type).toBe("order")
        const amounts = Object.fromEntries(
          data.order.shipping_methods.map((m: any) => [m.name, Number(m.amount)])
        )
        expect(amounts).toEqual({
          "Pallet delivery": 80,
          "Carton delivery": 100,
        })
        expect(Number(data.order.shipping_subtotal)).toBe(180)
      })

      it("lists the deliveries of every class, so the storefront must show the cart's own", async () => {
        const cart = await newCart("de", "10115", { "Rose Royal": 1 })
        const names = (await listOptions(cart.id)).map((o) => o.name).sort()
        // Both deliveries come back; each says which shipping profile it is for.
        expect(names).toEqual(["Carton delivery", "Pallet delivery"])
      })
    })

    describe("what the storefront reads", () => {
      const classIds = async () => {
        const profiles = (await api.get("/admin/shipping-profiles", { headers }))
          .data.shipping_profiles
        return Object.fromEntries(
          profiles.map((profile: any) => [profile.type, profile.id])
        ) as Record<string, string>
      }

      it("says which shipping class every product and every chosen delivery is for", async () => {
        const cart = await chooseDeliveries(
          await newCart("at", "8010", { "Bonsai Tree": 1, Magnolia: 2 })
        )
        const { data } = await api.get(
          `/store/carts/${cart.id}?fields=*items,*shipping_methods,items.variant.product.shipping_profile.id,shipping_methods.shipping_option.shipping_profile_id`,
          { headers: storeHeaders }
        )
        const ids = await classIds()

        expect(
          Object.fromEntries(
            data.cart.items.map((item: any) => [
              item.product_title,
              item.variant.product.shipping_profile.id,
            ])
          )
        ).toEqual({ "Bonsai Tree": ids.pallet, Magnolia: ids.carton })
        expect(
          Object.fromEntries(
            data.cart.shipping_methods.map((method: any) => [
              method.name,
              method.shipping_option.shipping_profile_id,
            ])
          )
        ).toEqual({
          "Pallet delivery": ids.pallet,
          "Carton delivery": ids.carton,
        })
      })

      it("lists each delivery with its shipping class and where it delivers from", async () => {
        const cart = await newCart("de", "10115", { "Rose Royal": 1 })
        const ids = await classIds()
        const options = await listOptions(cart.id)

        const carton = optionNamed(options, "Carton delivery")
        expect(carton.shipping_profile_id).toBe(ids.carton)
        expect(carton.price_type).toBe("calculated")
        expect(carton.service_zone.fulfillment_set.type).toBe("shipping")
        expect(optionNamed(options, "Pallet delivery").shipping_profile_id).toBe(
          ids.pallet
        )
      })

      it("keeps no delivery for products that left the cart, once the new ones have theirs", async () => {
        const cart = await chooseDeliveries(
          await newCart("at", "8010", { "Bonsai Tree": 1 })
        )
        expect(cart.shipping_methods.map((m: any) => m.name)).toEqual([
          "Pallet delivery",
        ])

        await api.delete(`/store/carts/${cart.id}/line-items/${cart.items[0].id}`, {
          headers: storeHeaders,
        })
        await api.post(
          `/store/carts/${cart.id}/line-items`,
          { variant_id: variants.Magnolia, quantity: 1 },
          { headers: storeHeaders }
        )
        const options = await listOptions(cart.id)
        await addMethod(cart.id, optionNamed(options, "Carton delivery").id)

        const after = await getCart(cart.id)
        expect(after.shipping_methods.map((m: any) => m.name)).toEqual([
          "Carton delivery",
        ])
        expect(Number(after.shipping_subtotal)).toBe(50)
      })
    })

    describe("editing the rates in the admin", () => {
      const austria = async () =>
        (await readTables()).tables.find(
          (t: any) => t.shipping_class === "pallet" && t.country_code === "at"
        )

      const save = (table: any) =>
        api.post(
          "/admin/shipping-rates/tables",
          {
            shipping_class: table.shipping_class,
            country_code: table.country_code,
            zones: table.zones,
            tiers: table.tiers,
          },
          { headers }
        )

      it("changes what the checkout charges, without code", async () => {
        const table = await austria()
        table.tiers[0].prices.z1 = 123.5
        await save(table)

        const cart = await newCart("at", "8010", { "Bonsai Tree": 1 })
        const options = await listOptions(cart.id)
        const quote = await calculate(
          cart.id,
          optionNamed(options, "Pallet delivery").id
        )
        expect(Number(quote.amount)).toBe(123.5)
      })

      it("moves a postcode to another zone", async () => {
        const table = await austria()
        table.zones.find((z: any) => z.id === "z4").postcodes = "6, 5"
        await save(table)

        const quote = (
          await api.get(
            "/admin/shipping-rates/quote?shipping_class=pallet&country_code=at&postcode=5020&units=1",
            { headers }
          )
        ).data.quote
        expect(quote.zone.name).toBe("Zone 4")
        expect(quote.zone_match).toBe("postcode")
      })

      it("switches to another one-pallet row", async () => {
        const table = await austria()
        table.tiers[0].active = false
        table.tiers[1].active = true
        await save(table)

        const quote = (
          await api.get(
            "/admin/shipping-rates/quote?shipping_class=pallet&country_code=at&postcode=8010&units=1",
            { headers }
          )
        ).data.quote
        expect(quote.amount).toBe(100)
      })

      it("adds a country and a class", async () => {
        await save({
          shipping_class: "pallet",
          country_code: "sk",
          zones: [
            { id: "all", name: "All of SK", postcodes: "", is_fallback: true },
          ],
          tiers: [
            {
              id: "one",
              label: "1 pallet",
              quantity: 1,
              active: true,
              prices: { all: 70 },
            },
          ],
        })

        const quote = (
          await api.get(
            "/admin/shipping-rates/quote?shipping_class=pallet&country_code=sk&units=3",
            { headers }
          )
        ).data.quote
        expect(quote.amount).toBe(210)
      })

      it("refuses a table that cannot price a delivery, and says why", async () => {
        const table = await austria()
        table.zones[0].postcodes = "12-5"
        table.tiers.forEach((t: any) => (t.active = false))

        const response = await save(table).catch((error) => error.response)
        expect(response.status).toBe(400)
        expect(response.data.message).toContain(
          '"12-5" is not a postcode start or a range'
        )
        expect(response.data.message).toContain(
          "has no price in any row that is switched on"
        )

        // Nothing was saved
        expect((await austria()).zones[0].postcodes).toBe("8")
      })

      it("deletes a table, after which that delivery cannot be priced", async () => {
        const table = await austria()
        await api.delete(`/admin/shipping-rates/tables/${table.id}`, {
          headers,
        })

        const cart = await newCart("at", "8010", { "Bonsai Tree": 1 })
        const options = await listOptions(cart.id)
        const response = await api
          .post(
            `/store/shipping-options/${optionNamed(options, "Pallet delivery").id}/calculate`,
            { cart_id: cart.id },
            { headers: storeHeaders }
          )
          .catch((error) => error.response)
        expect(response.status).toBeGreaterThanOrEqual(400)
        expect(JSON.stringify(response.data)).toContain(
          "no pallet delivery rates for AT"
        )
      })

      it("changes the forint rate", async () => {
        await api.post(
          "/admin/shipping-rates/currencies",
          { currency_code: "HUF", rate: 364.58 },
          { headers }
        )

        const cart = await newCart("hu", "1011", { "Rose Royal": 1 })
        const options = await listOptions(cart.id)
        const quote = await calculate(
          cart.id,
          optionNamed(options, "Carton delivery").id
        )
        // 50 euro at 364.58
        expect(Number(quote.amount)).toBe(18229)
      })

      it("refuses a rate that makes no sense, and euro", async () => {
        for (const body of [
          { currency_code: "huf", rate: 0 },
          { currency_code: "eur", rate: 1 },
          { currency_code: "forint", rate: 400 },
        ]) {
          const response = await api
            .post("/admin/shipping-rates/currencies", body, { headers })
            .catch((error) => error.response)
          expect(response.status).toBe(400)
        }
      })

      it("a currency with no rate cannot be given a delivery price", async () => {
        const { currencies } = await readTables()
        await api.delete(`/admin/shipping-rates/currencies/${currencies[0].id}`, {
          headers,
        })

        const response = await api
          .get(
            "/admin/shipping-rates/quote?shipping_class=carton&country_code=hu&units=1&currency_code=huf",
            { headers }
          )
          .catch((error) => error.response)
        expect(response.status).toBe(400)
        expect(response.data.message).toContain("no exchange rate to HUF")
      })

      it("keeps a table's id and refuses what is not an admin", async () => {
        const table = await austria()
        await save(table)
        expect((await austria()).id).toBe(table.id)

        const response = await api
          .get("/admin/shipping-rates")
          .catch((error) => error.response)
        expect(response.status).toBe(401)
      })
    })
  },
})
