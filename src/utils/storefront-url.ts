/**
 * Where the storefront is served: the base of every link the backend makes to
 * it. No trailing slash.
 */
export const storefrontUrl = (): string =>
  (
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    process.env.STOREFRONT_PUBLIC_URL ||
    "http://localhost:8000"
  ).replace(/\/+$/, "")

type RegionWithCountries = {
  countries?: Array<{ iso_2?: string | null } | null> | null
}

/**
 * The storefront's market addresses, `<language>-<country>`, one for each page
 * language it serves.
 *
 * Every country of every region is a market and a CMS page reads the same in
 * all of them, so the first country (alphabetically, to keep the answer
 * stable) is as good as any: the language comes from the prefix. Null when the
 * store has no region yet.
 */
export function marketLinks(
  base: string,
  regions: RegionWithCountries[]
): { en: string; de: string } | null {
  const [country] = regions
    .flatMap((region) => region.countries ?? [])
    .map((country) => country?.iso_2?.toLowerCase())
    .filter((code): code is string => !!code)
    .sort()

  return country
    ? { en: `${base}/en-${country}`, de: `${base}/de-${country}` }
    : null
}
