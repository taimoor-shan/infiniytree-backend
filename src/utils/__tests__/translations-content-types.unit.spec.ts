import { DmlEntity } from "@medusajs/framework/utils"
import BlogCategory from "../../modules/blog/models/blog-category"
import BlogPost from "../../modules/blog/models/blog-post"
import Page from "../../modules/page/models/page"
import {
  CONTENT_TYPES,
  contentFieldKeys,
  getContentType,
  requireContentType,
} from "../translations/content-types"

// Importing the models registers their translatable fields.
void [Page, BlogPost, BlogCategory]

const translatableFields = (entity: string) =>
  DmlEntity.getTranslatableEntities().find((e) => e.entity === entity)?.fields

describe("CONTENT_TYPES", () => {
  // The admin offers exactly the fields the models mark translatable():
  // a field missing here could never be translated, one extra would be
  // filtered out of every translation by the Translation module.
  it.each([
    ["page", "Page"],
    ["blog_post", "BlogPost"],
    ["blog_category", "BlogCategory"],
  ] as const)("%s offers the fields its model marks translatable", (reference, entity) => {
    expect([...contentFieldKeys(CONTENT_TYPES[reference])].sort()).toEqual(
      [...(translatableFields(entity) ?? [])].sort()
    )
  })

  it("edits long text with the rich-text editor and short text plainly", () => {
    const kinds = Object.fromEntries(
      CONTENT_TYPES.blog_post.fields.map((field) => [field.key, field.kind])
    )

    expect(kinds.content).toBe("html")
    expect(kinds.title).toBe("text")
    expect(kinds.excerpt).toBe("textarea")
  })
})

describe("getContentType / requireContentType", () => {
  it("finds a type by its reference and nothing else", () => {
    expect(getContentType("page")?.label).toBe("Page")
    expect(getContentType("product")).toBeUndefined()
    // Not looked up on the object prototype
    expect(getContentType("constructor")).toBeUndefined()
    expect(getContentType("__proto__")).toBeUndefined()
  })

  it("answers an unknown reference with a 400-type error", () => {
    expect(() => requireContentType("product")).toThrow(/cannot be translated/)
  })
})
