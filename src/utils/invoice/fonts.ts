/**
 * Font registration + asset path resolution.
 *
 * Registered once at first import (module side-effect, idempotent).
 * Font files live in the backend root `fonts/` directory and are copied
 * into `.medusa/server/fonts/` by postBuild.js so they resolve identically
 * in dev (cwd = backend root) and production (cwd = .medusa/server).
 */

import path from "path"
import fs from "fs"
import { Font } from "./react-pdf"

// ---------------------------------------------------------------------------
// Asset resolution
// ---------------------------------------------------------------------------

/**
 * Resolve an asset path that works in both:
 * 1. Dev: `yarn dev` → cwd = project root
 * 2. Prod: `yarn start` → cwd = .medusa/server (postBuild copies assets there)
 *
 * Tries multiple candidates and returns the first that exists on disk.
 */
function resolveAsset(relPath: string): string {
  const candidates = [
    // Production: assets copied to .medusa/server by postBuild.js
    path.join(process.cwd(), relPath),
    // Dev fallback: __dirname is .medusa/server/src/utils/invoice → go up 4 levels to project root
    path.join(__dirname, "..", "..", "..", "..", relPath),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  // Return the first candidate anyway — Font.register will throw a clear error
  return candidates[0]
}

/** Public: resolve an asset path for file reads (logo, images). */
export function getAssetPath(filename: string): string {
  return resolveAsset(filename)
}

/** Read a file as a base64 data URI (for <Image> tags that need inline data). */
export function getAssetDataUri(filename: string, mime: string): string {
  const filePath = resolveAsset(filename)
  const buf = fs.readFileSync(filePath)
  return `data:${mime};base64,${buf.toString("base64")}`
}

// ---------------------------------------------------------------------------
// Logo (cached at module load — reads once per process)
// ---------------------------------------------------------------------------

export const LOGO_DATA_URI: string = (() => {
  try {
    return getAssetDataUri("static/logo-full.png", "image/png")
  } catch {
    // Fallback: try the committed copy in invoice assets
    try {
      const assetPath = path.join(__dirname, "assets", "logo-full.png")
      if (fs.existsSync(assetPath)) {
        const buf = fs.readFileSync(assetPath)
        return `data:image/png;base64,${buf.toString("base64")}`
      }
    } catch { /* empty */ }
    console.warn("[invoice] Logo not found — header will render without logo.")
    return ""
  }
})()

// ---------------------------------------------------------------------------
// Font registration
// ---------------------------------------------------------------------------

const FONT_DIR = "fonts"

try {
  Font.register({
    family: "DM Sans",
    fonts: [
      {
        src: resolveAsset(`${FONT_DIR}/DMSans-Regular.ttf`),
        fontWeight: "normal",
      },
      {
        src: resolveAsset(`${FONT_DIR}/DMSans-Bold.ttf`),
        fontWeight: "bold",
      },
    ],
  })

  Font.register({
    family: "Bodoni Moda",
    fonts: [
      {
        src: resolveAsset(`${FONT_DIR}/BodoniModa-Regular.ttf`),
      },
    ],
  })
} catch (err: any) {
  console.warn(
    "[invoice] Font registration failed — falling back to Helvetica. " +
      "Ensure fonts/ directory contains DMSans-Regular.ttf, DMSans-Bold.ttf, BodoniModa-Regular.ttf. " +
      `Error: ${err.message}`
  )
}
