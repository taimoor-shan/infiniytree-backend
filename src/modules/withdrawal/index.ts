import { Module } from "@medusajs/framework/utils"
import WithdrawalModuleService from "./service"

export const WITHDRAWAL_MODULE = "withdrawal"

export default Module(WITHDRAWAL_MODULE, {
  service: WithdrawalModuleService,
})
