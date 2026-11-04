# Product specs

One JSON file per product, named after its handle (`olive-tree.json`). A spec is the
product written down once: its texts in English with German and Hungarian beside them,
its prices, options, shipping class and stock. `src/scripts/add-product.ts` turns it
into the product in the shop, so entering a product is a file instead of a hundred
clicks, and the file stays as the record of what was entered.

```
npx medusa exec ./src/scripts/add-product.ts product-specs/olive-tree.json check   # reads, writes nothing
npx medusa exec ./src/scripts/add-product.ts product-specs/olive-tree.json         # makes it, as a draft
```

On the server run the built file from `.medusa/server` (`add-product.js`).

- The fields, their defaults and what each becomes in the shop are in the add-product
  skill (`~/.claude/skills/add-product/references/spec-fields.md`) and the backend
  `CLAUDE.md` ("Adding a product from a spec").
- A text is English, or one text per language: `"Maintenance-free"` or
  `{ "en": "Maintenance-free", "de": "Pflegefrei", "hu": "Karbantartásmentes" }`.
- A key that starts with `_` is a note and is ignored (see `_note` in
  `blue-cascade.json`).
- **`blue-cascade.json` is a worked example and the fixture of the tests, not something
  to run on the live shop:** its product was renamed there ("Blue Cascade Composition"),
  so running it again would add a second one.
