/**
 * The shop's two shipping classes. A shipping class is a Medusa shipping
 * profile; a product belongs to one, and a cart pays one delivery for each
 * class it holds products of (see `setup-shipping.ts`).
 *
 * `type` is what the scripts look a class up by, so the name can be changed in
 * the admin without losing it. It is also the id of the rate table the
 * class is priced from (the `pallet` and `carton` rates under Shipping rates).
 */

/** Larger plants and trees: one full pallet per unit. */
export const PALLET_PROFILE = { name: "Pallet products", type: "pallet" }

/** Smaller pieces that travel in a carton: a fixed charge per unit. */
export const CARTON_PROFILE = { name: "Carton products", type: "carton" }

/** The name the pallet class was first given, before "Pallet products". */
export const LEGACY_PALLET_PROFILE_NAME = "Pallet product"

/**
 * Products are put in a class by their name. Anything that matches neither
 * keeps its shipping profile until someone assigns one in the admin.
 */
export const CARTON_PRODUCT_PATTERN = /rose\s*royal|magnolia/i
export const PALLET_PRODUCT_PATTERN =
  /cherry\s*blossom|bonsai|maple|orchid|blue\s*cascade/i

/**
 * The delivery option of each class: its name and the rate table it uses.
 * `german` is what German visitors read (see
 * `translate-blue-cascade-and-delivery.ts`); "Standardversand" is how the
 * standard option is already named.
 */
export const DELIVERY_OPTIONS = [
  {
    profile: PALLET_PROFILE,
    name: "Pallet delivery",
    code: "pallet-delivery",
    description: "Delivered on a pallet: the price depends on the postcode and the number of pallets.",
    german: {
      name: "Palettenversand",
      description:
        "Lieferung auf einer Palette: Der Preis richtet sich nach der Postleitzahl und der Anzahl der Paletten.",
    },
  },
  {
    profile: CARTON_PROFILE,
    name: "Carton delivery",
    code: "carton-delivery",
    description: "Delivered in a carton: a fixed charge for each carton.",
    german: {
      name: "Kartonversand",
      description: "Lieferung im Karton: ein fester Betrag je Karton.",
    },
  },
] as const

/** Medusa's id for the `tariff` provider registered as `rates` in medusa-config. */
export const TARIFF_PROVIDER_ID = "tariff_rates"
