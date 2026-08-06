/**
 * Single require() of @react-pdf/renderer (ESM-only package).
 * Every component imports from here — no other file requires the ESM package directly.
 *
 * Why require() and not import?
 * @react-pdf/renderer@4.x is "type": "module". Under Node16 module resolution
 * with a CJS project (no "type": "module" in package.json), a static import
 * fails with "referenced file is an ECMAScript module and cannot be imported
 * with require". The dynamic require() works on Node >= 22.12 (require(esm)).
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const pdf = require("@react-pdf/renderer") as Record<string, any>

export const Document = pdf.Document
export const Page = pdf.Page
export const Text = pdf.Text
export const View = pdf.View
export const Image = pdf.Image
export const StyleSheet = pdf.StyleSheet
export const Font = pdf.Font
export const renderToBuffer = pdf.renderToBuffer
