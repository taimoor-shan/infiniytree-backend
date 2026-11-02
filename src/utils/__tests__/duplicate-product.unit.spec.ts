import { slugify as adminSlugify } from "../../admin/lib/slugify"
import {
  buildProductCopy,
  CopiedProduct,
  copyHandle,
  planCopyExtras,
  slugify,
  SourceProduct,
  TranslationRow,
} from "../duplicate-product"

const EUROPE = "reg_europe"
const HUNGARY = "reg_hungary"

const GOLD_IMAGE = "https://shop.test/static/gold.jpg"
const FIRST_IMAGE = "https://shop.test/static/a.jpg"
const SECOND_IMAGE = "https://shop.test/static/b.jpg"

/** A product as the duplicate workflow reads it: options, variants, prices, images and links. */
const source = (): SourceProduct => ({
  id: "prod_source",
  title: "Blue Cascade",
  subtitle: "One of a kind",
  description: "A dramatic floral arrangement.",
  handle: "blue-cascade",
  status: "published",
  thumbnail: "https://shop.test/static/thumb.jpg",
  is_giftcard: false,
  discountable: true,
  weight: 12,
  length: null,
  height: 170,
  width: 150,
  origin_country: "hu",
  hs_code: "6702",
  mid_code: null,
  material: "Polyester",
  metadata: {
    seo_title: "Blue Cascade | InfinYtree",
    video_url: "/static/blue-cascade.mp4",
  },
  type_id: "ptyp_1",
  collection_id: "pcol_1",
  tags: [{ id: "ptag_1" }, { id: "ptag_2" }],
  categories: [{ id: "pcat_1" }],
  sales_channels: [{ id: "sc_1" }],
  shipping_profile: { id: "sp_pallet" },
  // Stored out of order on purpose: the copy keeps the gallery order. The
  // second picture is tied to one variant; the first to none, so every
  // variant shows it.
  images: [
    {
      id: "img_b",
      url: SECOND_IMAGE,
      rank: 1,
      metadata: null,
      variants: [{ id: "variant_gold_small" }],
    },
    {
      id: "img_a",
      url: FIRST_IMAGE,
      rank: 0,
      metadata: { alt: "front" },
      variants: [],
    },
  ],
  options: [
    {
      id: "opt_planter",
      title: "Planter",
      is_exclusive: false,
      metadata: null,
      values: [
        { id: "val_gold", value: "Gold", rank: 1 },
        { id: "val_blue", value: "Blue", rank: 0 },
      ],
    },
    {
      id: "opt_size",
      title: "Size",
      is_exclusive: false,
      metadata: null,
      values: [
        { id: "val_small", value: "Small", rank: 0 },
        { id: "val_large", value: "Large", rank: 1 },
      ],
    },
  ],
  variants: [
    {
      id: "variant_gold_small",
      title: "Gold / Small",
      sku: "BC-GOLD-S",
      barcode: "0123456789",
      ean: "4000000000000",
      upc: "012345678905",
      allow_backorder: true,
      manage_inventory: true,
      hs_code: null,
      origin_country: null,
      mid_code: null,
      material: null,
      weight: 5,
      length: null,
      height: null,
      width: null,
      variant_rank: 1,
      thumbnail: GOLD_IMAGE,
      metadata: { note: "second" },
      options: [
        { value: "Gold", option: { title: "Planter" } },
        { value: "Small", option: { title: "Size" } },
      ],
      price_set: {
        prices: [
          {
            currency_code: "eur",
            amount: 3250,
            min_quantity: null,
            max_quantity: null,
            price_list_id: null,
            price_rules: [],
          },
          {
            currency_code: "eur",
            amount: 3250,
            min_quantity: null,
            max_quantity: null,
            price_list_id: null,
            price_rules: [{ attribute: "region_id", value: EUROPE }],
          },
          {
            currency_code: "huf",
            amount: 1149000,
            min_quantity: 2,
            max_quantity: 10,
            price_list_id: null,
            price_rules: [{ attribute: "region_id", value: HUNGARY }],
          },
          // A sale price belongs to a price list, which this product's copy is not in.
          {
            currency_code: "eur",
            amount: 2990,
            min_quantity: null,
            max_quantity: null,
            price_list_id: "plist_sale",
            price_rules: [],
          },
        ],
      },
    },
    {
      id: "variant_blue_small",
      title: "Blue / Small",
      sku: null,
      barcode: null,
      ean: null,
      upc: null,
      allow_backorder: false,
      manage_inventory: true,
      hs_code: null,
      origin_country: null,
      mid_code: null,
      material: null,
      weight: null,
      length: null,
      height: null,
      width: null,
      variant_rank: 0,
      thumbnail: null,
      metadata: null,
      options: [
        // The options of a variant do not have to come in the product's order.
        { value: "Small", option: { title: "Size" } },
        { value: "Blue", option: { title: "Planter" } },
      ],
      price_set: null,
    },
  ],
})

const THE_COPY = { title: "Blue Cascade (Copy)", handle: "blue-cascade-copy" }

describe("slugify", () => {
  it("makes a handle the way the admin's preview does", () => {
    for (const title of [
      "Caring for Olive Trees!",
      "Pflanzenpflege für Büro",
      "Blue Cascade (Copy)",
      "Straße & Co",
      "  --  ",
    ]) {
      expect(slugify(title)).toBe(adminSlugify(title))
    }
  })
})

describe("copyHandle", () => {
  it("is the title as a handle", () => {
    expect(copyHandle("Blue Cascade II", [])).toBe("blue-cascade-ii")
  })

  it("drops accents so a German title gives a clean handle", () => {
    expect(copyHandle("Kunstblumen-Arrangement Größe Süd", [])).toBe(
      "kunstblumen-arrangement-grosse-sud"
    )
  })

  it("adds -2 when the handle is taken, then -3", () => {
    expect(copyHandle("Blue Cascade (Copy)", ["blue-cascade-copy"])).toBe(
      "blue-cascade-copy-2"
    )
    expect(
      copyHandle("Blue Cascade (Copy)", [
        "blue-cascade-copy",
        "blue-cascade-copy-2",
      ])
    ).toBe("blue-cascade-copy-3")
  })

  it("ignores handles that merely start the same", () => {
    expect(copyHandle("Blue Cascade", ["blue-cascade-ii", "blue"])).toBe(
      "blue-cascade"
    )
  })

  it("falls back to 'product' for a title with nothing a handle can hold", () => {
    expect(copyHandle("!!!", [])).toBe("product")
    expect(copyHandle("!!!", ["product"])).toBe("product-2")
  })
})

describe("buildProductCopy", () => {
  it("is a draft with the new title and handle, whatever the original was", () => {
    for (const status of ["published", "draft", "proposed", "rejected"]) {
      const copy = buildProductCopy({ ...source(), status }, THE_COPY)

      expect(copy.status).toBe("draft")
      expect(copy.title).toBe("Blue Cascade (Copy)")
      expect(copy.handle).toBe("blue-cascade-copy")
    }
  })

  it("keeps the texts, measurements and metadata of the original", () => {
    const original = source()
    const copy = buildProductCopy(original, THE_COPY)

    expect(copy).toMatchObject({
      subtitle: "One of a kind",
      description: "A dramatic floral arrangement.",
      thumbnail: "https://shop.test/static/thumb.jpg",
      is_giftcard: false,
      discountable: true,
      weight: 12,
      height: 170,
      width: 150,
      origin_country: "hu",
      hs_code: "6702",
      material: "Polyester",
      metadata: {
        seo_title: "Blue Cascade | InfinYtree",
        video_url: "/static/blue-cascade.mp4",
      },
    })
    // The metadata is a copy: editing one product's must not touch the other's.
    expect(copy.metadata).toEqual(original.metadata)
    expect(copy.metadata).not.toBe(original.metadata)
  })

  it("leaves out what the original does not have", () => {
    const copy = buildProductCopy(source(), THE_COPY)

    expect(copy).not.toHaveProperty("length")
    expect(copy).not.toHaveProperty("mid_code")
    expect(copy).not.toHaveProperty("id")
    expect(copy).not.toHaveProperty("external_id")
  })

  it("puts the copy in the same type, collection, categories, tags, sales channels and shipping class", () => {
    expect(buildProductCopy(source(), THE_COPY)).toMatchObject({
      type_id: "ptyp_1",
      collection_id: "pcol_1",
      category_ids: ["pcat_1"],
      tag_ids: ["ptag_1", "ptag_2"],
      sales_channels: [{ id: "sc_1" }],
      shipping_profile_id: "sp_pallet",
    })
  })

  it("keeps the gallery in its order", () => {
    expect(buildProductCopy(source(), THE_COPY).images).toEqual([
      { url: FIRST_IMAGE, metadata: { alt: "front" } },
      { url: SECOND_IMAGE },
    ])
  })

  it("keeps the options, with their choices in order", () => {
    expect(buildProductCopy(source(), THE_COPY).options).toEqual([
      { title: "Planter", values: ["Blue", "Gold"], is_exclusive: false },
      { title: "Size", values: ["Small", "Large"], is_exclusive: false },
    ])
  })

  it("keeps the variants in their order, each on the same choices", () => {
    const { variants } = buildProductCopy(source(), THE_COPY)

    expect(variants.map((variant) => variant.title)).toEqual([
      "Blue / Small",
      "Gold / Small",
    ])
    expect(variants[0].options).toEqual({ Planter: "Blue", Size: "Small" })
    expect(variants[1].options).toEqual({ Planter: "Gold", Size: "Small" })
  })

  it("keeps the rank of each variant, which is what orders them", () => {
    const { variants } = buildProductCopy(source(), THE_COPY)

    expect(variants.map((variant) => variant.variant_rank)).toEqual([0, 1])
  })

  it("keeps how each variant is stocked and measured", () => {
    const [, gold] = buildProductCopy(source(), THE_COPY).variants

    expect(gold).toMatchObject({
      allow_backorder: true,
      manage_inventory: true,
      weight: 5,
      metadata: { note: "second" },
    })
  })

  it("does not copy the SKU, barcode, EAN or UPC, which must be unique", () => {
    for (const variant of buildProductCopy(source(), THE_COPY).variants) {
      for (const key of ["sku", "barcode", "ean", "upc"]) {
        expect(variant).not.toHaveProperty(key)
      }
    }
  })

  it("does not tie the copy to the original's stock", () => {
    for (const variant of buildProductCopy(source(), THE_COPY).variants) {
      expect(variant).not.toHaveProperty("inventory_items")
    }
  })

  it("keeps the prices in every currency and region, but not the sale prices of a price list", () => {
    const [blue, gold] = buildProductCopy(source(), THE_COPY).variants

    expect(gold.prices).toEqual([
      { currency_code: "eur", amount: 3250 },
      { currency_code: "eur", amount: 3250, rules: { region_id: EUROPE } },
      {
        currency_code: "huf",
        amount: 1149000,
        min_quantity: 2,
        max_quantity: 10,
        rules: { region_id: HUNGARY },
      },
    ])
    // A variant with no prices stays without ("Price on request").
    expect(blue.prices).toEqual([])
  })

  it("does not change the original", () => {
    const original = source()
    buildProductCopy(original, THE_COPY)

    expect(original).toEqual(source())
  })
})

/** The copy as read back after it was created: the new ids. */
const copied = (): CopiedProduct => ({
  id: "prod_copy",
  options: [
    {
      id: "opt_planter_copy",
      title: "Planter",
      values: [
        { id: "val_blue_copy", value: "Blue" },
        { id: "val_gold_copy", value: "Gold" },
      ],
    },
    {
      id: "opt_size_copy",
      title: "Size",
      values: [
        { id: "val_small_copy", value: "Small" },
        { id: "val_large_copy", value: "Large" },
      ],
    },
  ],
  variants: [
    {
      id: "variant_blue_small_copy",
      title: "Blue / Small",
      options: [
        { value: "Blue", option: { title: "Planter" } },
        { value: "Small", option: { title: "Size" } },
      ],
    },
    {
      id: "variant_gold_small_copy",
      title: "Gold / Small",
      options: [
        { value: "Small", option: { title: "Size" } },
        { value: "Gold", option: { title: "Planter" } },
      ],
    },
  ],
  images: [
    { id: "img_a_copy", url: FIRST_IMAGE },
    { id: "img_b_copy", url: SECOND_IMAGE },
  ],
})

const row = (
  reference: string,
  reference_id: string,
  locale_code: string,
  translations: Record<string, unknown>
): TranslationRow => ({
  id: `trans_${reference}_${reference_id}_${locale_code}`,
  reference,
  reference_id,
  locale_code,
  translations,
})

describe("planCopyExtras", () => {
  const plan = (rows: TranslationRow[] = []) =>
    planCopyExtras(source(), copied(), rows)

  it("gives each new variant the thumbnail of the variant it was copied from", () => {
    expect(plan().variantThumbnails).toEqual([
      { variant_id: "variant_gold_small_copy", thumbnail: GOLD_IMAGE },
    ])
  })

  it("links each new variant to the new copies of the pictures tied to it", () => {
    // The first picture is tied to no variant, so the product module shows it
    // under every variant. It stays tied to none: linking it would take it
    // out of the shared pictures and out of any variant added later.
    expect(plan().variantImages).toEqual([
      { variant_id: "variant_gold_small_copy", image_id: "img_b_copy" },
    ])
  })

  it("ties a picture that two variants show to both of them", () => {
    const shared = source()
    shared.images![0].variants = [
      { id: "variant_gold_small" },
      { id: "variant_blue_small" },
    ]

    expect(planCopyExtras(shared, copied(), []).variantImages).toEqual([
      { variant_id: "variant_gold_small_copy", image_id: "img_b_copy" },
      { variant_id: "variant_blue_small_copy", image_id: "img_b_copy" },
    ])
  })

  it("skips a picture the copy does not have", () => {
    const withoutPictures = { ...copied(), images: [] }

    expect(
      planCopyExtras(source(), withoutPictures, []).variantImages
    ).toEqual([])
  })

  it("skips a picture tied to a variant the copy does not have", () => {
    const stale = source()
    stale.images![0].variants = [{ id: "variant_gone" }]

    expect(planCopyExtras(stale, copied(), []).variantImages).toEqual([])
  })

  it("moves the translations of the product, its options, choices and variants to the copy", () => {
    const rows = [
      row("product", "prod_source", "de-DE", {
        title: "Kunstblumen-Arrangement Blue Cascade",
        subtitle: "Einzigartig",
        description: "Ein dramatisches Blumenarrangement.",
      }),
      row("product_option", "opt_planter", "de-DE", { title: "Pflanzgefäß" }),
      row("product_option_value", "val_gold", "de-DE", { value: "Gold" }),
      row("product_variant", "variant_gold_small", "de-DE", {
        title: "Gold / Klein",
      }),
    ]

    expect(plan(rows).translations).toEqual([
      {
        reference: "product",
        reference_id: "prod_copy",
        locale_code: "de-DE",
        translations: {
          subtitle: "Einzigartig",
          description: "Ein dramatisches Blumenarrangement.",
        },
      },
      {
        reference: "product_option",
        reference_id: "opt_planter_copy",
        locale_code: "de-DE",
        translations: { title: "Pflanzgefäß" },
      },
      {
        reference: "product_option_value",
        reference_id: "val_gold_copy",
        locale_code: "de-DE",
        translations: { value: "Gold" },
      },
      {
        reference: "product_variant",
        reference_id: "variant_gold_small_copy",
        locale_code: "de-DE",
        translations: { title: "Gold / Klein" },
      },
    ])
  })

  it("does not carry the product's translated title over: it names the original", () => {
    const rows = [
      row("product", "prod_source", "de-DE", { title: "Blue Cascade DE" }),
      row("product", "prod_source", "hu-HU", {
        title: "Blue Cascade HU",
        subtitle: "Egyedi",
      }),
    ]

    // The Hungarian row keeps its subtitle; the German one has nothing left
    // and is not saved at all.
    expect(plan(rows).translations).toEqual([
      {
        reference: "product",
        reference_id: "prod_copy",
        locale_code: "hu-HU",
        translations: { subtitle: "Egyedi" },
      },
    ])
  })

  it("keeps the title of an option, choice or variant: they are the same in the copy", () => {
    const rows = [
      row("product_option", "opt_size", "de-DE", { title: "Größe" }),
    ]

    expect(plan(rows).translations[0].translations).toEqual({ title: "Größe" })
  })

  it("leaves out translations of things that are not part of the product", () => {
    const rows = [
      row("product_category", "pcat_1", "de-DE", { name: "Unikate" }),
      row("shipping_option", "so_1", "de-DE", { name: "Palettenversand" }),
      // A variant the copy does not have (deleted since, or never copied).
      row("product_variant", "variant_gone", "de-DE", { title: "Weg" }),
      row("product", "another_product", "de-DE", { subtitle: "Anders" }),
    ]

    expect(plan(rows).translations).toEqual([])
  })

  it("does not change the translations it was given", () => {
    const rows = [
      row("product", "prod_source", "de-DE", { title: "T", subtitle: "S" }),
    ]
    const before = JSON.parse(JSON.stringify(rows))

    plan(rows)

    expect(rows).toEqual(before)
  })
})
