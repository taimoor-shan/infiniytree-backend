/** Where the sales system tells the owner things: SALES_COMMISSION_NOTIFY_EMAIL, else the shop's contact address. */
export const ownerNotifyAddress = () =>
  process.env.SALES_COMMISSION_NOTIFY_EMAIL ||
  process.env.CONTACT_EMAIL ||
  "info@infinytree.com"

/** Where the owner opens a customer in the admin. */
export const adminCustomerUrl = (customerId: string) =>
  `${process.env.BACKEND_PUBLIC_URL || "http://localhost:9000"}/app/customers/${customerId}`
