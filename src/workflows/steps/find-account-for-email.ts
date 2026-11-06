import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { findAccountId } from "../../utils/account-email"

/** The account an email belongs to, or null. Reads only, so nothing to undo. */
export const findAccountForEmailStep = createStep(
  "find-account-for-email",
  async (input: { email?: string | null }, { container }) =>
    new StepResponse(await findAccountId(container, input.email))
)
