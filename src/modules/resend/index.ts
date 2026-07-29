import type { ModuleProviderExports } from "@medusajs/framework/types"
import { ResendNotificationService } from "./service"

const services = [ResendNotificationService]

const providerExport: ModuleProviderExports = {
  services,
}

export default providerExport
