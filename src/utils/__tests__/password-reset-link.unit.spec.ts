import { passwordResetLink } from "../password-reset-link"

describe("passwordResetLink", () => {
  it("sends a shop customer to the account's reset page", () => {
    expect(
      passwordResetLink({
        storefront_url: "https://infinytree.com",
        actor_type: "customer",
        token: "abc",
        email: "buyer@example.com",
      })
    ).toBe(
      "https://infinytree.com/account/reset-password?token=abc&email=buyer%40example.com"
    )
  })

  it("sends a sales rep to the sales portal's reset page", () => {
    expect(
      passwordResetLink({
        storefront_url: "https://infinytree.com",
        actor_type: "sales_rep",
        token: "abc",
        email: "peter@example.com",
      })
    ).toBe(
      "https://infinytree.com/sales-portal/reset-password?token=abc&email=peter%40example.com"
    )
  })

  it("escapes the token and the email", () => {
    expect(
      passwordResetLink({
        storefront_url: "https://infinytree.com",
        actor_type: "sales_rep",
        token: "a.b-c_d=e/f",
        email: "peter+test@example.com",
      })
    ).toBe(
      "https://infinytree.com/sales-portal/reset-password?token=a.b-c_d%3De%2Ff&email=peter%2Btest%40example.com"
    )
  })
})
