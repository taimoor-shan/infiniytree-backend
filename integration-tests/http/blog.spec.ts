import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

const DAY = 24 * 60 * 60 * 1000
const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString()
const words = (count: number) => Array(count).fill("leaf").join(" ")

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

    const createCategory = async (body: Record<string, unknown>) =>
      (await api.post("/admin/blog/categories", body, { headers })).data
        .category

    const createPost = async (body: Record<string, unknown>) =>
      (
        await api.post(
          "/admin/blog/posts",
          { title: "A post", ...body },
          { headers }
        )
      ).data.post

    const storeGet = (path: string) => api.get(path, { headers: storeHeaders })

    const handles = (posts: { handle: string }[]) =>
      posts.map((post) => post.handle)

    describe("admin: posts", () => {
      it("saves a draft with no publish date and works out the reading time", async () => {
        const post = await createPost({
          title: "Caring for olive trees",
          handle: "olive-care",
          content: `<p>${words(450)}</p>`,
        })

        expect(post).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^post_/),
            status: "draft",
            locale: "en",
            template: "standard",
            published_at: null,
            reading_time: 3,
          })
        )
      })

      it("stamps the publish date once and keeps it when the post is edited", async () => {
        const post = await createPost({ handle: "stamped", status: "published" })

        expect(post.published_at).toBeTruthy()

        const { data } = await api.post(
          `/admin/blog/posts/${post.id}`,
          { title: "Edited" },
          { headers }
        )

        expect(data.post.title).toBe("Edited")
        expect(new Date(data.post.published_at).getTime()).toBe(
          new Date(post.published_at).getTime()
        )
      })

      it("stamps the date when a draft is published later", async () => {
        const draft = await createPost({ handle: "later-published" })
        expect(draft.published_at).toBeNull()

        const { data } = await api.post(
          `/admin/blog/posts/${draft.id}`,
          { status: "published" },
          { headers }
        )

        expect(data.post.published_at).toBeTruthy()
      })

      it("recomputes the reading time when the body changes", async () => {
        const post = await createPost({
          handle: "reading",
          content: `<p>${words(10)}</p>`,
        })
        expect(post.reading_time).toBe(1)

        const { data } = await api.post(
          `/admin/blog/posts/${post.id}`,
          { content: `<p>${words(1000)}</p>` },
          { headers }
        )

        expect(data.post.reading_time).toBe(5)
      })

      it.each(["Olive Care", "olive_care", "-olive", "category"])(
        "rejects the handle %p",
        async (handle) => {
          const error = await failure(
            api.post("/admin/blog/posts", { title: "x", handle }, { headers })
          )

          expect(error.status).toBe(400)
        }
      )

      // A post is written once and translated, so a second post with the same
      // handle is a mistake whatever its language (the old workflow of
      // duplicating a post per language is what translations replace).
      it("rejects a second post with the same handle, in any language", async () => {
        await createPost({ handle: "twice", locale: "en" })

        for (const locale of ["en", "de-AT"]) {
          const error = await failure(
            api.post(
              "/admin/blog/posts",
              { title: "Again", handle: "twice", locale },
              { headers }
            )
          )

          expect(error.status).toBeGreaterThanOrEqual(400)
          expect(error.status).toBeLessThan(500)
        }
      })

      it("replaces the categories on update", async () => {
        const care = await createCategory({ name: "Care", handle: "care" })
        const style = await createCategory({ name: "Style", handle: "style" })
        const post = await createPost({
          handle: "with-categories",
          category_ids: [care.id],
        })

        expect(post.categories.map((c: { id: string }) => c.id)).toEqual([
          care.id,
        ])

        const { data } = await api.post(
          `/admin/blog/posts/${post.id}`,
          { category_ids: [style.id] },
          { headers }
        )

        expect(data.post.categories.map((c: { id: string }) => c.id)).toEqual([
          style.id,
        ])
      })

      it("deletes a post", async () => {
        const post = await createPost({ handle: "gone" })

        const { data } = await api.delete(`/admin/blog/posts/${post.id}`, {
          headers,
        })
        expect(data).toEqual({ id: post.id })

        const error = await failure(
          api.get(`/admin/blog/posts/${post.id}`, { headers })
        )
        expect(error.status).toBe(404)
      })

      it("lists with search and a status filter", async () => {
        await createPost({ title: "Olive tree care", handle: "olive" })
        await createPost({
          title: "Palm tree care",
          handle: "palm",
          status: "published",
        })

        const search = await api.get("/admin/blog/posts?q=olive", { headers })
        expect(handles(search.data.posts)).toEqual(["olive"])
        expect(search.data.count).toBe(1)

        const published = await api.get("/admin/blog/posts?status=published", {
          headers,
        })
        expect(handles(published.data.posts)).toEqual(["palm"])
      })
    })

    describe("admin: categories", () => {
      it("keeps the posts when a category is deleted", async () => {
        const category = await createCategory({ name: "Care", handle: "care" })
        const post = await createPost({
          handle: "survivor",
          category_ids: [category.id],
        })

        await api.delete(`/admin/blog/categories/${category.id}`, { headers })

        const { data } = await api.get(`/admin/blog/posts/${post.id}`, {
          headers,
        })
        expect(data.post.categories).toEqual([])
      })

      it("rejects a second category with the same handle", async () => {
        await createCategory({ name: "Care", handle: "care" })

        const error = await failure(
          api.post(
            "/admin/blog/categories",
            { name: "Care again", handle: "care" },
            { headers }
          )
        )

        expect(error.status).toBeGreaterThanOrEqual(400)
        expect(error.status).toBeLessThan(500)
      })

      it("lists every category", async () => {
        await createCategory({ name: "Style", handle: "style" })
        await createCategory({ name: "Care", handle: "care" })

        const { data } = await api.get("/admin/blog/categories", { headers })

        expect(data.categories.map((c: { name: string }) => c.name)).toEqual([
          "Care",
          "Style",
        ])
      })
    })

    describe("store: posts", () => {
      it("shows published posts, newest first, and hides drafts and scheduled posts", async () => {
        await createPost({
          handle: "old",
          status: "published",
          published_at: daysFromNow(-10),
        })
        await createPost({
          handle: "new",
          status: "published",
          published_at: daysFromNow(-1),
        })
        await createPost({ handle: "draft-one" })
        await createPost({
          handle: "scheduled",
          status: "published",
          published_at: daysFromNow(5),
        })

        const { data } = await storeGet("/store/blog/posts?locale=en")

        expect(handles(data.posts)).toEqual(["new", "old"])
        expect(data.count).toBe(2)
        // A card carries no body.
        expect(data.posts[0]).not.toHaveProperty("content")
      })

      it("pages through the list", async () => {
        for (const [index, handle] of ["a", "b", "c"].entries()) {
          await createPost({
            handle,
            status: "published",
            published_at: daysFromNow(-index - 1),
          })
        }

        const first = await storeGet("/store/blog/posts?limit=2&offset=0")
        const second = await storeGet("/store/blog/posts?limit=2&offset=2")

        expect(handles(first.data.posts)).toEqual(["a", "b"])
        expect(handles(second.data.posts)).toEqual(["c"])
        expect(first.data.count).toBe(3)
      })

      it("returns one article with its body and the language it is written in", async () => {
        await createPost({
          handle: "guide",
          locale: "en",
          status: "published",
          content: "<p>English body</p>",
          seo_title: "SEO title",
        })

        const { data } = await storeGet("/store/blog/posts/guide?locale=en")

        expect(data.post).toEqual(
          expect.objectContaining({
            handle: "guide",
            content: "<p>English body</p>",
            seo_title: "SEO title",
            locale: "en",
          })
        )
        expect(data.locales).toEqual(["en"])
      })

      it("shows a post written in another language as it is, when it has no translation", async () => {
        await createPost({
          handle: "nur-ungarisch",
          locale: "hu-HU",
          status: "published",
        })

        const single = await storeGet("/store/blog/posts/nur-ungarisch?locale=en")
        const list = await storeGet("/store/blog/posts?locale=en")

        expect(single.data.post.locale).toBe("hu-HU")
        expect(handles(list.data.posts)).toEqual(["nur-ungarisch"])
      })

      // 200 with `post: null`, not 404: the storefront's data cache keeps only
      // 200 responses, so a 404 would leave an unpublished post online.
      it("answers with no post for a draft, a scheduled post and an unknown handle", async () => {
        await createPost({ handle: "a-draft" })
        await createPost({
          handle: "not-yet",
          status: "published",
          published_at: daysFromNow(3),
        })

        for (const handle of ["a-draft", "not-yet", "no-such-post"]) {
          const response = await storeGet(`/store/blog/posts/${handle}`)

          expect(response.status).toBe(200)
          expect(response.data).toEqual({ post: null, locales: [] })
        }
      })

      it("answers with no category for an unknown handle", async () => {
        const response = await storeGet("/store/blog/categories/no-such-category")

        expect(response.status).toBe(200)
        expect(response.data).toEqual({ category: null })
      })

      it("filters by category and counts posts per category", async () => {
        const care = await createCategory({ name: "Plant care", handle: "plant-care" })
        await createCategory({ name: "Empty", handle: "empty" })
        await createPost({
          handle: "in-care",
          status: "published",
          category_ids: [care.id],
        })
        await createPost({ handle: "uncategorised", status: "published" })
        await createPost({
          handle: "draft-in-care",
          category_ids: [care.id],
        })

        const filtered = await storeGet(
          "/store/blog/posts?locale=en&category=plant-care"
        )
        expect(handles(filtered.data.posts)).toEqual(["in-care"])
        expect(filtered.data.count).toBe(1)

        const categories = await storeGet("/store/blog/categories?locale=en")
        // A category with no published post is left out.
        expect(categories.data.categories).toEqual([
          expect.objectContaining({ handle: "plant-care", post_count: 1 }),
        ])

        const one = await storeGet("/store/blog/categories/plant-care?locale=en")
        expect(one.data.category).toEqual(
          expect.objectContaining({ name: "Plant care", post_count: 1 })
        )
      })

      it("lists every published handle and category for the sitemap", async () => {
        const category = await createCategory({ name: "Care", handle: "care" })
        await createPost({
          handle: "one",
          status: "published",
          category_ids: [category.id],
        })
        await createPost({ handle: "hidden" })

        const { data } = await storeGet("/store/blog/sitemap")

        expect(handles(data.posts)).toEqual(["one"])
        expect(data.categories).toEqual([{ handle: "care" }])
      })
    })

    describe("pages: template", () => {
      it("saves the chosen template and serves it, with a default for older pages", async () => {
        const { data: created } = await api.post(
          "/admin/pages",
          {
            title: "Plant care",
            slug: "guides/plant-care",
            status: "published",
            is_public: true,
            template: "hero",
          },
          { headers }
        )
        expect(created.page.template).toBe("hero")

        await api.post(
          "/admin/pages",
          { title: "Plain", slug: "plain", status: "published", is_public: true },
          { headers }
        )

        // A slug with a slash is one URL segment once encoded.
        const nested = await storeGet(
          `/store/pages/${encodeURIComponent("guides/plant-care")}`
        )
        expect(nested.data.page).toEqual(
          expect.objectContaining({ slug: "guides/plant-care", template: "hero" })
        )

        const plain = await storeGet("/store/pages/plain")
        expect(plain.data.page.template).toBe("default")
      })

      // 200 with `page: null`, not 404, for the same reason as blog posts: the
      // storefront's data cache would otherwise keep serving an unpublished page.
      it("answers with no page for a draft and for an unknown slug", async () => {
        await api.post(
          "/admin/pages",
          { title: "Hidden", slug: "hidden", status: "draft", is_public: true },
          { headers }
        )

        for (const slug of ["hidden", "no-such-page"]) {
          const response = await storeGet(`/store/pages/${slug}`)

          expect(response.status).toBe(200)
          expect(response.data).toEqual({ page: null })
        }
      })

      it.each(["store", "blog", "products/olive", "/cart"])(
        "rejects the slug %p, which a built-in route would shadow",
        async (slug) => {
          const error = await failure(
            api.post("/admin/pages", { title: "x", slug }, { headers })
          )

          expect(error.status).toBe(400)
        }
      )
    })
  },
})
