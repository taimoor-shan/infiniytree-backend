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

  // The same copy in German, for `translate-blue-cascade-and-delivery.ts`.
  // One text serves both German markets (`de-AT` and `de-DE`). The title
  // follows the shop's other arrangement ("Kunstblumen-Arrangement Rose
  // Royale"), the badge its other one-of-a-kind pieces ("Einzigartig").
  german: {
    title: "Kunstblumen-Arrangement Blue Cascade",
    subtitle: "Einzigartig",
    shortDescription:
      "Blue Cascade ist eine einzigartige Blumenkomposition, die einen unvergesslichen visuellen Eindruck hinterlässt. Satte Blautöne, gestaffelte Texturen und eine üppig herabfallende Form machen sie zu einem außergewöhnlichen dekorativen Mittelpunkt für stilvolle Interieurs.",
    description: [
      "Blue Cascade ist ein dramatisches, einzigartiges Blumenarrangement für Räume, die ein mutiges und unvergessliches Statement verlangen.",
      "Die üppige Komposition verbindet gestaffelte Blüten, reiche Texturen und eine fließende Silhouette, die aus jedem Blickwinkel Tiefe, Bewegung und Eleganz schafft.",
      "Blue Cascade ist für Hotels, Boutiquen, Restaurants, Empfangsbereiche, Showrooms und hochwertige private Interieurs gestaltet und bietet die Wirkung einer großen Blumeninstallation, ohne den Pflegeaufwand frischer Blumen.",
      "Kein Gießen, kein Austauschen, keine tägliche Pflege – nur ein bleibendes botanisches Statement.",
    ].join("\n\n"),
    // In the order of `keyFeatures`.
    keyFeatures: [
      "Künstliche Blumenkomposition als Unikat",
      "Von Hand zusammengestelltes dekoratives Arrangement",
      "Pflegefrei",
      "Für den Innenbereich geeignet",
      "Ideal für Hotellerie, Einzelhandel, Gewerbe- und Wohnräume",
      "Einzigartige Komposition mit markanter, kaskadenartiger Silhouette",
    ],
    seoTitle:
      "Blue Cascade | Einzigartiges künstliches Blumenarrangement | InfinYtree",
    seoDescription:
      "Entdecken Sie Blue Cascade: ein einzigartiges, großformatiges Kunstblumen-Arrangement, das außergewöhnlichen Räumen mutige Eleganz und bleibende Wirkung verleiht.",
    planterOption: "Pflanzgefäß",
    planters: { Blue: "Blau", Gold: "Gold", White: "Weiß" } as Record<
      string,
      string
    >,
    // The "One of a kind" category.
    category: "Unikate",
  },

  // Hungarian is only kept in the metadata, where every product has it. The
  // storefront has no Hungarian pages yet, so nothing reads these today.
  hungarian: {
    shortDescription:
      "A Blue Cascade egyedi virágkompozíció, amelyet felejthetetlen vizuális hatás keltésére terveztek. A gazdag kék tónusok, a rétegzett textúrák és a dús, lefelé omló forma kivételes dekoratív központi elemmé teszik a kifinomult terek számára.",
    // In the order of `keyFeatures`.
    keyFeatures: [
      "Egyedi, egyetlen példányban készült művirág-kompozíció",
      "Kézzel összeállított dekoratív elrendezés",
      "Karbantartásmentes",
      "Beltéri használatra alkalmas",
      "Ideális vendéglátóipari, kereskedelmi, irodai és otthoni terekbe",
      "Egyedi kompozíció határozott, lefelé omló sziluettel",
    ],
    seoTitle: "Blue Cascade | Egyedi művirág-kompozíció | InfinYtree",
    seoDescription:
      "Fedezze fel a Blue Cascade-et, az egyedi, nagyméretű művirág-kompozíciót, amely merész eleganciát és maradandó hatást ad a kivételes tereknek.",
  },
}
