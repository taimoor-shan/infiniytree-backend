/**
 * Choices offered by the blog and page editors.
 *
 * Template keys are a contract with the storefront: each one names a layout
 * registered in `src/modules/cms` (pages) or `src/modules/blog` (posts) there.
 * The storefront shows its default layout for a key it does not know, so a key
 * can be added here before its layout is deployed without breaking anything.
 * To add a layout: build it in the storefront, register it, then list it here.
 */

export type Option = { value: string; label: string; description?: string }

export const LOCALES: Option[] = [
  { value: "en", label: "English (en)" },
  { value: "de-AT", label: "German - Austria (de-AT)" },
  { value: "de-DE", label: "German - Germany (de-DE)" },
  { value: "hu-HU", label: "Hungarian (hu-HU)" },
]

export const PAGE_TEMPLATES: Option[] = [
  {
    value: "default",
    label: "Default",
    description: "Title, intro, image and text in one centered column.",
  },
  {
    value: "hero",
    label: "Hero banner",
    description:
      "The featured image fills the top with the title over it, then the text.",
  },
  {
    value: "narrow",
    label: "Narrow text (legal, policies)",
    description: "A single narrow column of text with no image or extras.",
  },
  {
    value: "contact",
    label: "Contact",
    description: "Text on the left and the contact form on the right.",
  },
]

export const POST_TEMPLATES: Option[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Title and intro above the image, text in a reading column.",
  },
  {
    value: "wide",
    label: "Wide hero",
    description:
      "A full-width image at the top with the title over it, then the text.",
  },
]

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  de: "German",
  "de-AT": "German (Austria)",
  "de-DE": "German (Germany)",
  "de-CH": "German (Switzerland)",
  hu: "Hungarian",
  "hu-HU": "Hungarian",
  "fr-FR": "French",
  "es-ES": "Spanish",
  "it-IT": "Italian",
}

/** A readable name for a locale code; the code itself when it is not known. */
export const localeName = (code: string): string => LOCALE_NAMES[code] ?? code
