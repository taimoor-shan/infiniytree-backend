import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

const intParam = (min: number, max?: number) =>
  z
    .preprocess(
      (val) => (typeof val === "string" ? parseInt(val, 10) : val),
      max === undefined ? z.number().int().min(min) : z.number().int().min(min).max(max)
    )
    .optional()

export const GetAdminMediaSchema = z.object({
  limit: intParam(1, 200),
  offset: intParam(0),
  q: z.string().optional(),
  status: z.enum(["all", "used", "unused", "recent", "protected"]).optional(),
  refresh: z
    .preprocess((val) => val === true || val === "true", z.boolean())
    .optional(),
})
export type GetAdminMediaSchema = z.infer<typeof GetAdminMediaSchema>

const nameList = z.array(z.string().min(1).max(1024)).min(1).max(500)

export const PostAdminMediaTrashSchema = z.object({ names: nameList })
export type PostAdminMediaTrashSchema = z.infer<typeof PostAdminMediaTrashSchema>

export const PostAdminMediaTrashIdsSchema = z.object({ ids: nameList })
export type PostAdminMediaTrashIdsSchema = z.infer<typeof PostAdminMediaTrashIdsSchema>

export const mediaAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/media",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetAdminMediaSchema, {})],
  },
  {
    matcher: "/admin/media/trash",
    method: "POST",
    middlewares: [validateAndTransformBody(PostAdminMediaTrashSchema)],
  },
  {
    matcher: "/admin/media/trash/restore",
    method: "POST",
    middlewares: [validateAndTransformBody(PostAdminMediaTrashIdsSchema)],
  },
  {
    matcher: "/admin/media/trash/delete",
    method: "POST",
    middlewares: [validateAndTransformBody(PostAdminMediaTrashIdsSchema)],
  },
]
