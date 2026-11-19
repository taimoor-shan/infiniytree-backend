import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

const toInt = (val: unknown) =>
  typeof val === "string" ? parseInt(val, 10) : val

export const GetAdminWithdrawalsSchema = z.object({
  limit: z.preprocess(toInt, z.number().min(1).max(100).optional()).optional(),
  offset: z.preprocess(toInt, z.number().min(0).optional()).optional(),
  status: z.enum(["new", "handled"]).optional(),
})

export const UpdateAdminWithdrawalSchema = z.object({
  status: z.enum(["new", "handled"]),
})

export const withdrawalAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/withdrawals",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetAdminWithdrawalsSchema, {})],
  },
  {
    matcher: "/admin/withdrawals/:id",
    method: "POST",
    middlewares: [validateAndTransformBody(UpdateAdminWithdrawalSchema)],
  },
]
