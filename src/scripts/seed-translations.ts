import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function seedTranslations({ container }: ExecArgs) {
  const translationModuleService = container.resolve(Modules.TRANSLATION);
  
  const settings = await translationModuleService.createTranslationSettings({
    entity_type: "product",
    fields: ["title", "description", "subtitle"],
    is_active: true,
  });
  console.log("Settings created:", settings);
}
