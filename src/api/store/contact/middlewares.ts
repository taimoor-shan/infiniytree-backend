import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http";
import { ContactSchema } from "./route";

export const contactStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/contact",
    method: "POST",
    middlewares: [validateAndTransformBody(ContactSchema)],
  },
];
