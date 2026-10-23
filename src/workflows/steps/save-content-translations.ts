import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { ITranslationModuleService } from "@medusajs/types"
import {
  CONTENT_TYPES,
  ContentReference,
  contentFieldKeys,
} from "../../utils/translations/content-types"

export type SaveContentTranslationsInput = {
  reference: ContentReference
  id: string
  /** Each locale gets the same values: the variants of one language. */
  locales: string[]
  /**
   * Field → text. A filled value sets that field's translation; a blank one
   * removes it; a field not listed is left alone. When nothing is left the
   * translation row itself is removed.
   */
  values: Record<string, string>
}

type Change =
  | { kind: "created"; locale: string; id: string }
  | { kind: "updated"; locale: string; id: string; before: Record<string, string> }
  // The row was deleted and created again (see "replace" below): `id` is the
  // new row.
  | { kind: "replaced"; locale: string; id: string; before: Record<string, string> }
  | { kind: "deleted"; locale: string; before: Record<string, string> }

/**
 * Saves translations of a page, post or category into Medusa's Translation
 * module, the store products' translations use. Compensation puts every
 * language back as it was.
 */
export const saveContentTranslationsStep = createStep(
  "save-content-translations",
  async (input: SaveContentTranslationsInput, { container }) => {
    const type = CONTENT_TYPES[input.reference]
    const allowed = new Set(contentFieldKeys(type))

    for (const key of Object.keys(input.values)) {
      if (!allowed.has(key)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `"${key}" is not a translatable field of a ${type.label.toLowerCase()}`
        )
      }
    }

    // Fails with a 404 for a record that does not exist.
    await type.retrieve(container, input.id)

    const service: ITranslationModuleService = container.resolve(
      Modules.TRANSLATION
    )
    const changes: Change[] = []

    for (const locale of input.locales) {
      const [row] = await service.listTranslations(
        {
          reference: input.reference,
          reference_id: input.id,
          locale_code: locale,
        },
        { take: 1 }
      )

      const before = (row?.translations ?? {}) as Record<string, string>
      const next: Record<string, string> = { ...before }

      for (const [key, value] of Object.entries(input.values)) {
        if (value.trim() !== "") {
          next[key] = value
        } else {
          delete next[key]
        }
      }

      if (JSON.stringify(next) === JSON.stringify(before)) {
        continue
      }

      if (!Object.keys(next).length) {
        if (row) {
          await service.deleteTranslations(row.id)
          changes.push({ kind: "deleted", locale, before })
        }
        continue
      }

      if (row) {
        const removesAField = Object.keys(before).some((key) => !(key in next))

        if (removesAField) {
          // The Translation module's update merges the JSON it is given, so a
          // key can never be removed by updating. Replace the row instead.
          await service.deleteTranslations(row.id)

          const replacement = await service.createTranslations({
            reference: input.reference,
            reference_id: input.id,
            locale_code: locale,
            translations: next as any,
          })

          changes.push({
            kind: "replaced",
            locale,
            id: (Array.isArray(replacement) ? replacement[0] : replacement).id,
            before,
          })
          continue
        }

        await service.updateTranslations({ id: row.id, translations: next })
        changes.push({ kind: "updated", locale, id: row.id, before })
        continue
      }

      const created = await service.createTranslations({
        reference: input.reference,
        reference_id: input.id,
        locale_code: locale,
        translations: next as any,
      })

      changes.push({
        kind: "created",
        locale,
        id: (Array.isArray(created) ? created[0] : created).id,
      })
    }

    return new StepResponse(
      { saved: changes.map((change) => change.locale) },
      { reference: input.reference, id: input.id, changes }
    )
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    const service: ITranslationModuleService = container.resolve(
      Modules.TRANSLATION
    )

    for (const change of compensation.changes) {
      if (change.kind === "created") {
        await service.deleteTranslations(change.id)
      } else if (change.kind === "updated") {
        // Restores values, not removed keys: the module merges on update. A
        // change that removed keys is a "replaced" one, handled below.
        await service.updateTranslations({
          id: change.id,
          translations: change.before,
        })
      } else if (change.kind === "replaced") {
        await service.deleteTranslations(change.id)
        await service.createTranslations({
          reference: compensation.reference,
          reference_id: compensation.id,
          locale_code: change.locale,
          translations: change.before as any,
        })
      } else {
        await service.createTranslations({
          reference: compensation.reference,
          reference_id: compensation.id,
          locale_code: change.locale,
          translations: change.before as any,
        })
      }
    }
  }
)
