import {
  copyAddress,
  suggestedCopyTitle,
} from "../../admin/lib/duplicate-product"
import { handleBase } from "../duplicate-product"

describe("suggestedCopyTitle", () => {
  it("is the title with (Copy) after it, for the admin to change", () => {
    expect(suggestedCopyTitle("Blue Cascade")).toBe("Blue Cascade (Copy)")
  })

  it("does not carry stray spaces over", () => {
    expect(suggestedCopyTitle("  Blue Cascade ")).toBe("Blue Cascade (Copy)")
  })
})

describe("copyAddress", () => {
  it("is the address the server will give the copy, so the dialog does not promise another", () => {
    for (const title of [
      "Blue Cascade II",
      "Blue Cascade (Copy)",
      "Kunstblumen-Arrangement Größe Süd",
      "Straße & Co",
      "!!!",
      "   ",
    ]) {
      expect(copyAddress(title)).toBe(handleBase(title))
    }
  })
})
