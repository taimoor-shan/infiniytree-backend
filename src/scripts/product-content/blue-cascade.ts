/**
 * Blue Cascade: the copy and facts of the product, as the shop owner gave them.
 * `add-blue-cascade.ts` turns this into the product.
 */
export const blueCascade = {
  title: "Blue Cascade",
  handle: "blue-cascade",

  // The badge the shop's one-of-a-kind pieces carry on their cards.
  subtitle: "One of a kind",

  // Shown under the title.
  shortDescription:
    "Blue Cascade is a one-of-a-kind floral composition designed to create an unforgettable visual impact. Rich blue tones, layered textures and an abundant cascading form make it an exceptional decorative centerpiece for refined interiors.",

  // One paragraph each; the product page keeps the blank lines between them.
  description: [
    "Blue Cascade is a dramatic one-of-a-kind floral arrangement created for interiors that call for a bold and memorable statement.",
    "Its abundant composition combines layered blooms, rich textures and a flowing silhouette that creates depth, movement and elegance from every angle.",
    "Designed for hotels, boutiques, restaurants, reception areas, showrooms and high-end private interiors, Blue Cascade offers the visual impact of a grand floral installation without the maintenance of fresh flowers.",
    "No watering, no replacement, no daily care — just a lasting botanical statement.",
  ].join("\n\n"),

  // Shown as "Key features" on the product page.
  keyFeatures: [
    "One-of-a-kind artificial floral composition",
    "Hand-assembled decorative arrangement",
    "Maintenance-free",
    "Suitable for indoor use",
    "Ideal for hospitality, retail, commercial and residential interiors",
    "Unique composition with a bold cascading silhouette",
  ],

  // Ranges, so they cannot sit in Medusa's single-number height/width/length.
  // The product page shows them as approximate.
  approxDimensions: {
    height: "160–180",
    width: "140–170",
    depth: "80–100",
    unit: "cm",
  },

  seoTitle:
    "Blue Cascade | One-of-a-Kind Artificial Floral Arrangement | InfinYtree",
  seoDescription:
    "Discover Blue Cascade, a one-of-a-kind large-scale artificial floral arrangement designed to bring bold elegance and lasting impact to exceptional interiors.",

  // The planter is not confirmed yet: every choice exists, none is in stock.
  planterOption: "Planter",
  planters: ["Blue", "Gold", "White"],
}
