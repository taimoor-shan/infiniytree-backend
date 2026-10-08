import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http";
import { requireTurnstile } from "../../../utils/turnstile";
import { ContactSchema } from "./route";

export const contactStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/contact",
    method: "POST",
    // The Turnstile check runs first so bots are turned away before any other work.
    middlewares: [requireTurnstile, validateAndTransformBody(ContactSchema)],
  },
];
