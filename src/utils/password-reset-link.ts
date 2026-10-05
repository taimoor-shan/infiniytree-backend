/**
 * The link in a password-reset email. Shop customers reset on the account
 * page; sales reps reset in the sales portal, which has its own pages.
 */
export const passwordResetLink = ({
  storefront_url,
  actor_type,
  token,
  email,
}: {
  storefront_url: string
  actor_type?: string
  token: string
  email: string
}): string => {
  const path =
    actor_type === "sales_rep"
      ? "/sales-portal/reset-password"
      : "/account/reset-password"

  return `${storefront_url}${path}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
}
