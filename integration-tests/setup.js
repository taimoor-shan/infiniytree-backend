const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// Tests enter the exchange rates they need; they never call the ECB
process.env.SALES_COMMISSION_FX_FETCH = "false"

// medusa-config.ts loads the project's .env even when tests run, so the keys
// of the live services would reach the test app. Orders created and canceled
// by tests would be posted to the real Make.com scenario, and emails sent
// through the real Resend account. Setting a variable here comes first:
// dotenv doesn't replace one that already exists.
//
// The Resend provider can't start without a key, so it gets one that the API
// refuses; the others are left empty.
process.env.RESEND_API_KEY = "re_disabled_in_tests"
process.env.SENDGRID_API_KEY = ""
process.env.SENDGRID_FROM = ""
process.env.MAKE_ORDER_WEBHOOK_URL = ""
process.env.MAKE_WEBHOOK_SECRET = ""
