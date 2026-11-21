import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createAdminHeaders } from "./helpers/admin-auth"
import { waitFor } from "./helpers/orders"
import { recordEvents } from "./helpers/portal"
import {
  readHomeBanner,
  withHomeBanner,
  type HomeBannerForm,
} from "../../src/admin/lib/home-banner"

jest.setTimeout(120 * 1000)

// `src/utils/revalidate-cache.ts` reads the secret when it is loaded, which is
// when the app starts, after this line. Setting it here (the test setup blanks
// it, so no test calls a storefront running on this machine) lets the tests
// below see the request the backend would send; `fetch` is stubbed in each test.
process.env.REVALIDATION_SECRET = "test-secret"

const VIDEO = "/static/1730000000000-banner.mp4"
const STILL = "/static/1730000000001-banner.jpg"

/** What the store's metadata already holds, which saving the banner must not touch. */
const OTHER = { seo_title: "InfinYtree", announcement: "Free delivery" }

const EMPTY: HomeBannerForm = {
  video: "",
  poster: "",
  heightDesktop: "",
  heightMobile: "",
  hidden: false,
}

const FULL: HomeBannerForm = {
  video: VIDEO,
  poster: STILL,
  heightDesktop: "640",
  heightMobile: "380",
  hidden: false,
}

/**
 * The "Homepage video banner" box in the admin saves the banner in the store's
 * metadata with the ordinary store update, and the storefront reads it back from
 * `GET /store/site`. This is the contract in between: what Medusa does with the
 * metadata the box sends, and what the storefront's request gets.
 *
 * The important part is the first: Medusa REPLACES a store's metadata with what
 * it is sent (the store module saves with `upsertWithReplace`), where a product's
 * is merged and a key set to "" is removed. The box therefore sends the other
 * keys back with its own and leaves a cleared key out (`withHomeBanner`).
 *
 * The second is how a saved banner reaches the site: Medusa announces no store
 * change (no `store.updated` event), so `src/api/admin/stores/middlewares.ts`
 * asks the storefront to refresh what it keeps from the store after every
 * successful store update.
 *
 * The tests marked "why" pin the Medusa behaviour that makes those two things
 * necessary, so an upgrade that changes it shows up here.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let storeHeaders: Record<string, string>
    let storeId: string
    let events: ReturnType<typeof recordEvents> | undefined
    let fetchSpy: jest.SpyInstance

    /** The requests the backend sent to the storefront's revalidate endpoint. */
    const revalidations = () =>
      fetchSpy.mock.calls.filter(([url]) =>
        String(url).endsWith("/api/revalidate")
      )

    beforeEach(async () => {
      // The storefront is not called: its answer is made up.
      fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
        async () =>
          new Response(JSON.stringify({ revalidated: ["store", "locales"] }), {
            status: 200,
          })
      )

      const container = getContainer()
      const admin = await createAdminHeaders(container)
      headers = admin.headers

      const key = await container.resolve(Modules.API_KEY).createApiKeys({
        title: "storefront",
        type: "publishable",
        created_by: admin.user.id,
      })
      storeHeaders = { "x-publishable-api-key": key.token }

      const storeModule = container.resolve(Modules.STORE)
      const [store] = await storeModule.listStores()
      storeId = store.id
      await storeModule.updateStores(store.id, { metadata: OTHER })

      // The event bus keeps its subscribers between tests: subscribe once.
      events ??= recordEvents(container, ["store.updated"])
      events.clear()
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    const adminMetadata = async () =>
      (
        await api.get(`/admin/stores/${storeId}?fields=id,+metadata`, {
          headers,
        })
      ).data.store.metadata

    /** What the storefront's own request for the store gets. */
    const storefrontStore = async () =>
      (await api.get("/store/site", { headers: storeHeaders })).data.store

    /** Saves the way the box does: the store's current metadata, then the form. */
    const saveBanner = async (form: HomeBannerForm) =>
      api.post(
        `/admin/stores/${storeId}`,
        { metadata: withHomeBanner(await adminMetadata(), form) },
        { headers }
      )

    it("a store starts without a banner", async () => {
      expect(readHomeBanner(await adminMetadata())).toEqual(EMPTY)
    })

    it("saving the banner writes its keys and leaves the rest of the metadata alone", async () => {
      const response = await saveBanner(FULL)
      expect(response.status).toBe(200)

      expect(await adminMetadata()).toEqual({
        ...OTHER,
        home_banner_video: VIDEO,
        home_banner_poster: STILL,
        home_banner_height_desktop: "640",
        home_banner_height_mobile: "380",
      })
    })

    it("the storefront's request for the store returns it", async () => {
      await saveBanner(FULL)

      const store = await storefrontStore()
      expect(store.id).toBe(storeId)
      expect(readHomeBanner(store.metadata)).toEqual(FULL)
      expect(store.metadata).toMatchObject(OTHER)
    })

    it("hiding the banner keeps its video and heights, showing it again removes the switch", async () => {
      await saveBanner(FULL)
      await saveBanner({ ...FULL, hidden: true })

      let metadata = await adminMetadata()
      expect(metadata.home_banner_hidden).toBe("true")
      expect(readHomeBanner(metadata)).toEqual({ ...FULL, hidden: true })

      await saveBanner(FULL)
      metadata = await adminMetadata()
      expect(metadata).not.toHaveProperty("home_banner_hidden")
      expect(readHomeBanner(metadata)).toEqual(FULL)
    })

    it("replacing the video and the heights keeps one value per key", async () => {
      await saveBanner(FULL)
      await saveBanner({
        ...FULL,
        video: "/static/1730000000002-new.mp4",
        heightDesktop: "",
        heightMobile: "420",
      })

      expect(readHomeBanner(await adminMetadata())).toEqual({
        video: "/static/1730000000002-new.mp4",
        poster: STILL,
        heightDesktop: "",
        heightMobile: "420",
        hidden: false,
      })
    })

    it("taking the video away removes the banner's keys and nothing else", async () => {
      await saveBanner(FULL)
      // The still image is still in the form when the video is cleared; it goes
      // with the video, because alone it does nothing.
      const response = await saveBanner({ ...EMPTY, poster: STILL })
      expect(response.status).toBe(200)

      const metadata = await adminMetadata()
      expect(metadata).toEqual(OTHER)
      expect((await storefrontStore()).metadata).toEqual(OTHER)
    })

    it("saving an empty box on a store without a banner adds no keys", async () => {
      await saveBanner(EMPTY)

      expect(await adminMetadata()).toEqual(OTHER)
    })

    it("Medusa's own store edit leaves the banner alone", async () => {
      await saveBanner(FULL)

      // What the Store settings drawer sends: fields of the store, no metadata.
      const response = await api.post(
        `/admin/stores/${storeId}`,
        { name: "InfinYtree Shop" },
        { headers }
      )
      expect(response.status).toBe(200)

      expect(await adminMetadata()).toEqual({
        ...OTHER,
        home_banner_video: VIDEO,
        home_banner_poster: STILL,
        home_banner_height_desktop: "640",
        home_banner_height_mobile: "380",
      })
    })

    it("why the box sends the other keys back: Medusa replaces a store's metadata, it does not merge it", async () => {
      const response = await api.post(
        `/admin/stores/${storeId}`,
        { metadata: { home_banner_video: VIDEO } },
        { headers }
      )
      expect(response.status).toBe(200)

      expect(await adminMetadata()).toEqual({ home_banner_video: VIDEO })
    })

    it('why a cleared key is left out: Medusa keeps a key sent as ""', async () => {
      await saveBanner(FULL)
      await api.post(
        `/admin/stores/${storeId}`,
        { metadata: { ...(await adminMetadata()), home_banner_video: "" } },
        { headers }
      )

      const metadata = await adminMetadata()
      expect(metadata).toHaveProperty("home_banner_video", "")
      // The page reads an empty text as no video, so it would still show no banner.
      expect(readHomeBanner(metadata).video).toBe("")
    })

    it("a store update asks the storefront to refresh what it keeps from the store, so the banner shows at once", async () => {
      await saveBanner(FULL)

      const [[url, init]] = await waitFor(async () => {
        const sent = revalidations()
        return sent.length > 0 && sent
      })
      expect(String(url)).toMatch(/\/api\/revalidate$/)
      expect(init.method).toBe("POST")
      expect(init.headers["x-revalidate-secret"]).toBe("test-secret")
      expect(JSON.parse(init.body)).toEqual({ tags: ["store", "locales"] })
    })

    it("Medusa's own store edit refreshes it too", async () => {
      await api.post(
        `/admin/stores/${storeId}`,
        { name: "InfinYtree Shop" },
        { headers }
      )

      await waitFor(async () => revalidations().length > 0)
    })

    it("an update Medusa refuses refreshes nothing", async () => {
      const response = await api.post(
        `/admin/stores/${storeId}`,
        { supported_currencies: "not a list" },
        { headers, validateStatus: () => true }
      )
      expect(response.status).toBeGreaterThanOrEqual(400)

      await new Promise((resolve) => setTimeout(resolve, 500))
      expect(revalidations()).toHaveLength(0)
    })

    it("why the refresh is not left to an event: Medusa emits no store.updated of its own", async () => {
      // Let what the setup saved arrive first.
      await adminMetadata()
      await new Promise((resolve) => setTimeout(resolve, 500))
      events!.clear()

      await saveBanner(FULL)
      await waitFor(async () => revalidations().length > 0)
      await new Promise((resolve) => setTimeout(resolve, 500))

      // If a Medusa upgrade starts announcing store changes, the refresh above
      // is no longer the only way to reach the storefront and this fails.
      expect(events!.seen).toEqual([])
    })
  },
})
