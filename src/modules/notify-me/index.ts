import { Module } from "@medusajs/framework/utils"
import NotifyMeModuleService from "./service"

export const NOTIFY_ME_MODULE = "notifyMe"

export default Module(NOTIFY_ME_MODULE, {
  service: NotifyMeModuleService,
})
