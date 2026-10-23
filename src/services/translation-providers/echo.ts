/**
 * EchoProvider
 *
 * Does not translate: it returns each text with the target locale in front,
 * for example `[de-DE] <p>Hello</p>`. It needs no key and no network, so tests
 * and local dry runs of the translation workflows can run without calling a
 * paid service.
 *
 *   TRANSLATION_PROVIDER=echo
 */

import type { TranslationProvider, TranslatableField } from "./provider"

export class EchoProvider implements TranslationProvider {
  async translate(
    fields: TranslatableField[],
    _sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>> {
    return Object.fromEntries(
      fields.map((field) => [field.key, `[${targetLocale}] ${field.text}`])
    )
  }
}
