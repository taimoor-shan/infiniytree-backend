import {
  OPTION_ORDER_KEY,
  moveItem,
  optionOrderChanges,
  readOptionOrder,
  sortProductOptions,
  valueRanks,
  type OrderOption,
} from "../../admin/lib/option-order"

const POT: OrderOption = {
  id: "opt_pot",
  title: "Pot",
  values: [
    { id: "v_gold", value: "Gold", rank: 2 },
    { id: "v_white", value: "White", rank: null },
    { id: "v_black", value: "Black", rank: 1 },
  ],
}
const PLANT: OrderOption = {
  id: "opt_plant",
  title: "Plant",
  values: [
    { id: "v_rose", value: "Rose", rank: 1 },
    { id: "v_green", value: "Green", rank: 2 },
  ],
}

describe("option order (admin box)", () => {
  it("pins the metadata key the storefront reads", () => {
    expect(OPTION_ORDER_KEY).toBe("option_order")
  })

  it("reads a list of ids, or JSON text of one", () => {
    expect(readOptionOrder({ option_order: ["a", "b"] })).toEqual(["a", "b"])
    expect(readOptionOrder({ option_order: '["a"]' })).toEqual(["a"])
    expect(readOptionOrder({ option_order: "nope" })).toEqual([])
    expect(readOptionOrder(null)).toEqual([])
  })

  it("opens with the saved option order and values by rank, unranked last", () => {
    const sorted = sortProductOptions([POT, PLANT], {
      option_order: ["opt_plant", "opt_pot"],
    })
    expect(sorted.map((o) => o.id)).toEqual(["opt_plant", "opt_pot"])
    expect(sorted[1].values.map((v) => v.value)).toEqual(["Black", "Gold", "White"])
  })

  it("puts an option the saved order does not know last", () => {
    expect(
      sortProductOptions([POT, PLANT], { option_order: ["opt_plant"] }).map((o) => o.id)
    ).toEqual(["opt_plant", "opt_pot"])
  })

  it("moves an item as a drag does", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"])
    expect(moveItem(["a"], 0, 3)).toEqual(["a"])
  })

  it("ranks values 1, 2, 3 in the order shown", () => {
    expect(valueRanks(POT.values)).toEqual({ Gold: 1, White: 2, Black: 3 })
  })

  it("asks to save only what differs from what Medusa holds", () => {
    const shown = sortProductOptions([POT, PLANT], { option_order: ["opt_pot", "opt_plant"] })
    // Pot shows Black, Gold, White but holds 1, 2, null: its ranks are sent.
    // Plant holds 1, 2 in the order shown: nothing to send.
    const changes = optionOrderChanges(shown, {
      options: [POT, PLANT],
      metadata: { option_order: ["opt_pot", "opt_plant"] },
    })
    expect(changes.optionOrder).toBeNull()
    expect(changes.ranks).toEqual([
      { optionId: "opt_pot", ranks: { Black: 1, Gold: 2, White: 3 } },
    ])
  })

  it("asks to save the option order when it changed", () => {
    const changes = optionOrderChanges([PLANT, POT], { options: [POT, PLANT], metadata: {} })
    expect(changes.optionOrder).toEqual(["opt_plant", "opt_pot"])
  })
})
