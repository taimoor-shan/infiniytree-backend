import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  postcodes: z.string(),
  is_fallback: z.boolean(),
})

const TierSchema = z.object({
  id: z.string(),
  label: z.string(),
  quantity: z.number(),
  active: z.boolean(),
  // A price per zone id; null (or missing) is a zone this row does not serve.
  prices: z.record(z.string(), z.number().nullable()),
})

export const PostAdminShippingRateTableSchema = z.object({
  shipping_class: z.string(),
  country_code: z.string(),
  zones: z.array(ZoneSchema),
  tiers: z.array(TierSchema),
})

export type PostAdminShippingRateTableSchema = z.infer<
  typeof PostAdminShippingRateTableSchema
>

export const PostAdminShippingCurrencyRateSchema = z.object({
  currency_code: z.string(),
  rate: z.number(),
})

export type PostAdminShippingCurrencyRateSchema = z.infer<
  typeof PostAdminShippingCurrencyRateSchema
>

export const GetAdminShippingQuoteSchema = z.object({
  shipping_class: z.string(),
  country_code: z.string(),
  postcode: z.string().optional(),
  units: z.preprocess(
    (val) => (typeof val === "string" ? parseInt(val, 10) : val),
    z.number()
  ),
  currency_code: z.string().optional(),
})

export type GetAdminShippingQuoteSchema = z.infer<
  typeof GetAdminShippingQuoteSchema
>

export const shippingRatesAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/shipping-rates/tables",
    method: "POST",
    middlewares: [validateAndTransformBody(PostAdminShippingRateTableSchema)],
  },
  {
    matcher: "/admin/shipping-rates/currencies",
    method: "POST",
    middlewares: [
      validateAndTransformBody(PostAdminShippingCurrencyRateSchema),
    ],
  },
  {
    matcher: "/admin/shipping-rates/quote",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetAdminShippingQuoteSchema, {})],
  },
]
