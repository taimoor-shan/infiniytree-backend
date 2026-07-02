import { Module } from "@medusajs/framework/utils"
import PageModuleService from "./service"

export const PAGE_MODULE = "page"

export default Module(PAGE_MODULE, {
  service: PageModuleService,
})
