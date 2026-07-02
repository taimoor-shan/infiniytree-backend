/**
 * GeminiProvider
 *
 * Uses the official Google GenAI SDK (@google/genai) for batch
 * product translation. All fields are sent in a single LLM request
 * and the JSON response is validated before returning.
 *
 * Configure via .env:
 *   GEMINI_API_KEY=your-key-here
 */

import type { TranslationProvider, TranslatableField } from "./provider"
import { normalizeLocale } from "./normalize-locale"

// ── Prompt Template ─────────────────────────────────────────────

function buildPrompt(
  fields: TranslatableField[],
  sourceLocale: string,
  targetLocale: string
): string {
  const inputJson = JSON.stringify(
    Object.fromEntries(fields.map((f) => [f.key, f.text])),
    null,
    2
  )

  return `You are a product translator. Translate all values from ${sourceLocale} to ${targetLocale}.

Rules:
- Preserve all HTML tags exactly as they appear.
- Do NOT translate URLs (href, src, or any http/https links).
- Do NOT translate SKUs, product codes, or numeric identifiers.
- Do NOT translate botanical names (e.g. "Monstera deliciosa").
- Do NOT translate brand names unless they are ordinary descriptive words.
- Preserve Markdown formatting (bold, italic, lists, etc.).
- Preserve all whitespace, line breaks, and indentation.
- Return ONLY a valid JSON object with the same keys as the input.
- Do not add, remove, or rename any keys.

Input:
{
  "title": "Monstera Deliciosa - Swiss Cheese Plant",
  "description": "<p>A tropical beauty with <strong>iconic holey leaves</strong>.</p>",
  "subtitle": "Easy care, pet-friendly"
}

Output:
{
  "title": "Monstera Deliciosa - Schweizer Käsepflanze",
  "description": "<p>Eine tropische Schönheit mit <strong>ikonischen löchrigen Blättern</strong>.</p>",
  "subtitle": "Einfache Pflege, haustierfreundlich"
}

Now translate this input from ${sourceLocale} to ${targetLocale}:
${inputJson}`
}

// ── JSON Parsing Helpers ────────────────────────────────────────

/**
 * Strip markdown code fences that the LLM may wrap JSON in.
 */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim()
}

/**
 * Validate the parsed translation result:
 *  1. Must be a plain object (not array, not null)
 *  2. All input keys must be present
 *  3. Every value must be a non-empty string
 *  4. No extra keys
 */
function validateTranslations(
  inputKeys: Set<string>,
  output: Record<string, unknown>
): asserts output is Record<string, string> {
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    throw new Error("Gemini response is not a JSON object")
  }

  const outputKeys = Object.keys(output)

  // Check for extra keys
  const extraKeys = outputKeys.filter((k) => !inputKeys.has(k))
  if (extraKeys.length > 0) {
    throw new Error(`Gemini returned unexpected keys: ${extraKeys.join(", ")}`)
  }

  // Check all input keys are present and valid
  for (const key of inputKeys) {
    if (!(key in output)) {
      throw new Error(`Gemini response missing key: "${key}"`)
    }
    const value = output[key]
    if (typeof value !== "string") {
      throw new Error(
        `Gemini returned non-string value for "${key}": ${typeof value}`
      )
    }
    if (value.trim() === "") {
      throw new Error(`Gemini returned empty string for "${key}"`)
    }
  }
}

// ── Provider ────────────────────────────────────────────────────

export class GeminiProvider implements TranslationProvider {
  private async getClient(): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. GeminiProvider requires a valid API key."
      )
    }
    // Dynamic import — @google/genai is ESM-only, Medusa runs in CommonJS
    const { GoogleGenAI } = await import("@google/genai")
    return new GoogleGenAI({ apiKey })
  }

  async translate(
    fields: TranslatableField[],
    sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>> {
    if (fields.length === 0) return {}

    const from = normalizeLocale(sourceLocale || "en")
    const to = normalizeLocale(targetLocale)

    const inputKeys = new Set(fields.map((f) => f.key))
    const prompt = buildPrompt(fields, from, to)

    const client = await this.getClient()

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1, // Low temperature for consistent translations
        maxOutputTokens: 8192,
      },
    })

    const rawText = response.text
    if (!rawText || rawText.trim() === "") {
      throw new Error("Gemini returned an empty response")
    }

    // Parse and validate
    let parsed: unknown
    try {
      parsed = JSON.parse(stripCodeFences(rawText))
    } catch {
      throw new Error(
        `Gemini returned invalid JSON. Raw response: ${rawText.slice(0, 200)}`
      )
    }

    validateTranslations(inputKeys, parsed as Record<string, unknown>)

    return parsed as Record<string, string>
  }
}
