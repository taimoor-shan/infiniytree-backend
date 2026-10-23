import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

// `integration-tests/setup.js` sets TRANSLATION_PROVIDER=echo (every text comes
// back as `[<target locale>] <text>`) and AUTO_TRANSLATE_LOCALES=de,hu.

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let storeHeaders: Record<string, string>

    beforeEach(async () => {
      const container = getContainer()
      const admin = await createAdminHeaders(container)
      headers = admin.headers

      const key = await container.resolve(Modules.API_KEY).createApiKeys({
        title: "storefront",
        type: "publishable",
        created_by: admin.user.id,
      })
      storeHeaders = { "x-publishable-api-key": key.token }
    })

    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (error) => error.response
      )

    const storeGet = (path: string) => api.get(path, { headers: storeHeaders })

    const createPage = async (body: Record<string, unknown>) =>
      (
        await api.post(
          "/admin/pages",
          { status: "published", is_public: true, ...body },
          { headers }
        )
      ).data.page

    const createCategory = async (body: Record<string, unknown>) =>
      (await api.post("/admin/blog/categories", body, { headers })).data.category

    const createPost = async (body: Record<string, unknown>) =>
      (
        await api.post(
          "/admin/blog/posts",
          { title: "A post", status: "published", ...body },
          { headers }
        )
      ).data.post

    const translate = (
      reference: string,
      id: string,
      body: Record<string, unknown> = {}
    ) =>
      api.post(`/admin/content-translations/${reference}/${id}/translate`, body, {
        headers,
      })

    const savedTranslation = (
      reference: string,
      id: string,
      locale: string,
      values: Record<string, string>
    ) =>
      api.post(
        `/admin/content-translations/${reference}/${id}`,
        { locale, values },
        { headers }
      )

    const pageAs = async (slug: string, locale: string) =>
      (await storeGet(`/store/pages/${slug}?locale=${locale}`)).data.page

    describe("pages", () => {
      const about = {
        title: "About us",
        slug: "about-us",
        excerpt: "We make plants",
        content: "<h2>Hello</h2><p>World</p>",
        seo_title: "About SEO",
      }

      it("translates a page into the configured languages and serves each visitor theirs", async () => {
        const page = await createPage(about)

        const { data } = await translate("page", page.id)

        expect(data).toEqual(
          expect.objectContaining({
            completed: ["de-DE", "hu-HU"],
            failed: [],
          })
        )

        const german = await pageAs("about-us", "de-DE")
        expect(german).toEqual(
          expect.objectContaining({
            title: "[de-DE] About us",
            excerpt: "[de-DE] We make plants",
            content: "[de-DE] <h2>Hello</h2><p>World</p>",
            seo_title: "[de-DE] About SEO",
            // Shared, not translated: the same slug and layout in every language
            slug: "about-us",
            template: "default",
            locale: "de-DE",
          })
        )

        expect((await pageAs("about-us", "hu-HU")).title).toBe("[hu-HU] About us")
        // The original, for English and for a language with no translation
        expect((await pageAs("about-us", "en")).title).toBe("About us")
        expect((await pageAs("about-us", "fr-FR")).title).toBe("About us")
        // Another variant of a translated language falls back to it
        expect((await pageAs("about-us", "de-AT")).title).toBe("[de-DE] About us")
      })

      it("tells the editor which languages exist and what to translate into", async () => {
        const page = await createPage(about)
        await translate("page", page.id)

        const { data } = await api.get(
          `/admin/content-translations/page/${page.id}`,
          { headers }
        )

        expect(data.source).toEqual(
          expect.objectContaining({
            locale: "en",
            values: expect.objectContaining({ title: "About us" }),
          })
        )
        expect(data.fields.map((field: { key: string }) => field.key)).toEqual([
          "title",
          "excerpt",
          "content",
          "seo_title",
          "seo_description",
        ])
        expect(data.target_locales).toEqual(["de-DE", "hu-HU"])
        expect(Object.keys(data.translations).sort()).toEqual(["de-DE", "hu-HU"])
        expect(data.translations["de-DE"].values.title).toBe("[de-DE] About us")
        expect(data.provider).toEqual({ name: "echo", configured: true })

        const list = await api.get("/admin/pages", { headers })
        expect(
          list.data.pages.find((p: { id: string }) => p.id === page.id)
            .translated_locales
        ).toEqual(["de-DE", "hu-HU"])
      })

      it("keeps an edited translation unless told to overwrite it", async () => {
        const page = await createPage(about)
        await translate("page", page.id)

        await savedTranslation("page", page.id, "de-DE", { title: "Über uns" })
        await translate("page", page.id)

        // Re-translating fills only what is missing: the proofread title stays.
        expect((await pageAs("about-us", "de-DE")).title).toBe("Über uns")

        await translate("page", page.id, { locales: ["de-DE"], overwrite: true })
        expect((await pageAs("about-us", "de-DE")).title).toBe("[de-DE] About us")
      })

      it("fills only the fields that are still untranslated", async () => {
        const page = await createPage({ ...about, excerpt: null })
        await translate("page", page.id, { locales: ["de-DE"] })

        // The excerpt is added to the original later: only it is translated.
        await api.post(
          `/admin/pages/${page.id}`,
          { excerpt: "Fresh excerpt" },
          { headers }
        )
        await savedTranslation("page", page.id, "de-DE", { title: "Über uns" })
        await translate("page", page.id, { locales: ["de-DE"] })

        const german = await pageAs("about-us", "de-DE")
        expect(german.title).toBe("Über uns")
        expect(german.excerpt).toBe("[de-DE] Fresh excerpt")
      })

      it("saves an editor's own translation, removes a field with a blank value, and deletes a language", async () => {
        const page = await createPage(about)

        await savedTranslation("page", page.id, "de-DE", {
          title: "Über uns",
          excerpt: "Wir machen Pflanzen",
        })

        let german = await pageAs("about-us", "de-DE")
        expect(german.title).toBe("Über uns")
        expect(german.excerpt).toBe("Wir machen Pflanzen")
        // Not translated: shown in the original language
        expect(german.content).toBe("<h2>Hello</h2><p>World</p>")

        await savedTranslation("page", page.id, "de-DE", { excerpt: "" })
        german = await pageAs("about-us", "de-DE")
        expect(german.excerpt).toBe("We make plants")
        expect(german.title).toBe("Über uns")

        await api.delete(
          `/admin/content-translations/page/${page.id}?locale=de-DE`,
          { headers }
        )
        expect((await pageAs("about-us", "de-DE")).title).toBe("About us")
      })

      it("lets a page written in the visitor's language win over a translation, as before", async () => {
        const english = await createPage({ ...about, slug: "about-legacy" })
        const german = await createPage({
          ...about,
          slug: "about-legacy",
          locale: "de-AT",
          title: "Über uns (alt)",
        })
        await translate("page", english.id)

        // The record written in German is shown to every German visitor.
        expect((await pageAs("about-legacy", "de-DE")).title).toBe("Über uns (alt)")
        expect((await pageAs("about-legacy", "de-AT")).title).toBe("Über uns (alt)")
        // Hungarian has no such record: it gets the translation.
        expect((await pageAs("about-legacy", "hu-HU")).title).toBe("[hu-HU] About us")

        // The editor is told that the separate German page takes priority.
        const { data } = await api.get(
          `/admin/content-translations/page/${english.id}`,
          { headers }
        )
        expect(data.native_versions).toEqual([
          { id: german.id, locale: "de-AT", status: "published" },
        ])
      })

      it("never translates a page into its own language", async () => {
        const page = await createPage({ ...about, slug: "uber", locale: "de-AT" })

        const { data } = await translate("page", page.id)
        expect(data.completed).toEqual(["hu-HU"])

        const error = await failure(translate("page", page.id, { locales: ["de-DE"] }))
        expect(error.status).toBe(400)
      })

      it("rejects what cannot be translated", async () => {
        const page = await createPage(about)

        expect(
          (await failure(translate("product", "prod_1"))).status
        ).toBe(400)
        expect(
          (await failure(translate("page", page.id, { locales: ["xx-YY"] }))).status
        ).toBe(400)
        // A field that is not translatable: a slug is shared by every language.
        expect(
          (
            await failure(
              savedTranslation("page", page.id, "de-DE", { slug: "ueber-uns" })
            )
          ).status
        ).toBe(400)
        expect(
          (await failure(savedTranslation("page", page.id, "xx-YY", { title: "x" })))
            .status
        ).toBe(400)
        const unknown = await failure(
          translate("page", "no_such_page", { locales: ["de-DE"] })
        )
        expect(unknown.status).toBe(404)
      })

      it("explains when auto-translation is not set up", async () => {
        const page = await createPage(about)
        const provider = process.env.TRANSLATION_PROVIDER
        delete process.env.TRANSLATION_PROVIDER

        try {
          const error = await failure(translate("page", page.id))

          expect(error.status).toBeGreaterThanOrEqual(400)
          expect(error.status).toBeLessThan(500)
          expect(error.data.message).toContain("TRANSLATION_PROVIDER")
        } finally {
          process.env.TRANSLATION_PROVIDER = provider
        }
      })
    })

    describe("long articles", () => {
      it("translates in pieces and puts every piece back in order", async () => {
        // About 18,000 characters: more than one request carries.
        const paragraphs = Array.from(
          { length: 60 },
          (_, index) => `<p>Paragraph ${index}. ${"leaf ".repeat(55)}</p>`
        )
        const content = paragraphs.join("")
        expect(content.length).toBeGreaterThan(15000)

        const post = await createPost({ handle: "long-read", content })
        await translate("blog_post", post.id, { locales: ["de-DE"] })

        const { data } = await storeGet("/store/blog/posts/long-read?locale=de-DE")
        const german: string = data.post.content

        // Sent as several requests: the echo prefix appears once per piece...
        expect(german.split("[de-DE] ").length - 1).toBeGreaterThan(1)
        // ...and with the prefixes removed the article is exactly the original.
        expect(german.split("[de-DE] ").join("")).toBe(content)
        expect(data.post.title).toBe("[de-DE] A post")
      })
    })

    describe("blog", () => {
      it("serves a post and its category in the visitor's language", async () => {
        const category = await createCategory({
          name: "Plant care",
          handle: "plant-care",
          description: "Keep plants fresh",
        })
        const post = await createPost({
          title: "How to care for olive trees",
          handle: "olive-care",
          excerpt: "Dust monthly",
          content: "<p>Use a soft brush.</p>",
          category_ids: [category.id],
        })

        await translate("blog_category", category.id)
        await translate("blog_post", post.id)

        const list = (await storeGet("/store/blog/posts?locale=de-DE")).data
        expect(list.posts).toHaveLength(1)
        expect(list.posts[0]).toEqual(
          expect.objectContaining({
            handle: "olive-care",
            title: "[de-DE] How to care for olive trees",
            excerpt: "[de-DE] Dust monthly",
            locale: "de-DE",
          })
        )
        // A list card carries no body, translated or not.
        expect(list.posts[0]).not.toHaveProperty("content")
        expect(list.posts[0].categories).toEqual([
          expect.objectContaining({ handle: "plant-care", name: "[de-DE] Plant care" }),
        ])

        // The category filter works with the handle, which is the same in every language.
        const filtered = (
          await storeGet("/store/blog/posts?locale=de-DE&category=plant-care")
        ).data
        expect(filtered.count).toBe(1)

        const categories = (await storeGet("/store/blog/categories?locale=de-DE")).data
        expect(categories.categories).toEqual([
          expect.objectContaining({
            handle: "plant-care",
            name: "[de-DE] Plant care",
            post_count: 1,
          }),
        ])

        const oneCategory = (
          await storeGet("/store/blog/categories/plant-care?locale=de-DE")
        ).data.category
        expect(oneCategory).toEqual(
          expect.objectContaining({
            name: "[de-DE] Plant care",
            description: "[de-DE] Keep plants fresh",
          })
        )

        const single = (
          await storeGet("/store/blog/posts/olive-care?locale=de-DE")
        ).data
        expect(single.post.content).toBe("[de-DE] <p>Use a soft brush.</p>")
        expect(single.locales).toEqual(["de-DE", "en", "hu-HU"])

        // English visitors get the original.
        const english = (await storeGet("/store/blog/posts/olive-care?locale=en")).data
        expect(english.post.title).toBe("How to care for olive trees")
        expect(english.post.locale).toBe("en")
      })

      it("shows the original to a visitor whose language it was not translated into", async () => {
        const post = await createPost({ handle: "olive-care", title: "Olive care" })
        await translate("blog_post", post.id, { locales: ["hu-HU"] })

        const german = (await storeGet("/store/blog/posts/olive-care?locale=de-DE")).data

        expect(german.post.title).toBe("Olive care")
        expect(german.locales).toEqual(["en", "hu-HU"])
        expect(
          (await storeGet("/store/blog/posts/olive-care?locale=hu-HU")).data.post.title
        ).toBe("[hu-HU] Olive care")
      })

      it("keeps a draft's translations private and never exposes a translation without its post", async () => {
        const post = await createPost({ handle: "secret", status: "draft" })
        await translate("blog_post", post.id)

        const response = await storeGet("/store/blog/posts/secret?locale=de-DE")
        expect(response.data).toEqual({ post: null, locales: [] })

        const list = (await storeGet("/store/blog/posts?locale=de-DE")).data
        expect(list.posts).toEqual([])
      })
    })

    describe("deleting a translated record", () => {
      const translationsOf = (id: string) =>
        getContainer()
          .resolve(Modules.TRANSLATION)
          .listTranslations({ reference_id: id }, { take: 100 })

      it("takes its translations with it, so none are left behind", async () => {
        const page = await createPage({ title: "Gone page", slug: "gone-page" })
        const category = await createCategory({ name: "Gone", handle: "gone" })
        const post = await createPost({ title: "Gone post", handle: "gone-post" })

        await translate("page", page.id)
        await translate("blog_category", category.id)
        await translate("blog_post", post.id)

        // One row for each of the two languages.
        expect(await translationsOf(page.id)).toHaveLength(2)
        expect(await translationsOf(category.id)).toHaveLength(2)
        expect(await translationsOf(post.id)).toHaveLength(2)

        await api.delete(`/admin/pages/${page.id}`, { headers })
        await api.delete(`/admin/blog/categories/${category.id}`, { headers })
        await api.delete(`/admin/blog/posts/${post.id}`, { headers })

        expect(await translationsOf(page.id)).toHaveLength(0)
        expect(await translationsOf(category.id)).toHaveLength(0)
        expect(await translationsOf(post.id)).toHaveLength(0)
      })

      it("leaves other records' translations alone", async () => {
        const gone = await createPage({ title: "Gone", slug: "gone" })
        const kept = await createPage({ title: "Kept", slug: "kept" })

        await translate("page", gone.id)
        await translate("page", kept.id)

        await api.delete(`/admin/pages/${gone.id}`, { headers })

        expect(await translationsOf(gone.id)).toHaveLength(0)
        expect(await translationsOf(kept.id)).toHaveLength(2)
        expect((await pageAs("kept", "de-DE")).title).toBe("[de-DE] Kept")
      })
    })
  },
})
