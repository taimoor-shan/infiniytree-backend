import { withoutCustomerDetails } from "../customer-privacy"

const anna = {
  id: "cus_1",
  email: "anna@example.com",
  first_name: "Anna",
  last_name: "Huber",
  phone: "+43 660 1234567",
  company_name: "Olive Interiors GmbH",
  metadata: { vat_number: "ATU12345678" },
  addresses: [{ address_1: "Geheimgasse 7" }],
  groups: [{ id: "cusgroup_1" }],
}

const onlyIdAndEmail = { id: "cus_1", email: "anna@example.com" }

describe("withoutCustomerDetails", () => {
  it("keeps only the id and email of a cart's customer", () => {
    expect(
      withoutCustomerDetails({
        cart: { id: "cart_1", email: "anna@example.com", customer: anna },
      })
    ).toEqual({
      cart: { id: "cart_1", email: "anna@example.com", customer: onlyIdAndEmail },
    })
  })

  it("does the same for the order a completed cart answers with", () => {
    expect(
      withoutCustomerDetails({ type: "order", order: { id: "order_1", customer: anna } })
    ).toEqual({ type: "order", order: { id: "order_1", customer: onlyIdAndEmail } })
  })

  it("does the same for every order of a list", () => {
    expect(
      withoutCustomerDetails({
        orders: [{ id: "order_1", customer: anna }, { id: "order_2" }],
        count: 2,
      })
    ).toEqual({
      orders: [{ id: "order_1", customer: onlyIdAndEmail }, { id: "order_2" }],
      count: 2,
    })
  })

  it("leaves a cart without a customer, and other answers, as they are", () => {
    expect(withoutCustomerDetails({ cart: { id: "cart_1", customer: null } })).toEqual({
      cart: { id: "cart_1", customer: null },
    })
    expect(withoutCustomerDetails({ type: "not_allowed", message: "No" })).toEqual({
      type: "not_allowed",
      message: "No",
    })
    expect(withoutCustomerDetails(undefined)).toBeUndefined()
  })
})
