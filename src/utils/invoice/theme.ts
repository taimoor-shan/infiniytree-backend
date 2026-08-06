/**
 * Design tokens for the Infinytree invoice PDF.
 * Single source of truth — change once, updates everywhere.
 *
 * Colors are softened for paper-print quality (never use pure #000).
 */

export const theme = {
  colors: {
    /** Primary text — warm near-black for paper */
    primary: "#2D2A26",
    /** Secondary / body text */
    secondary: "#746F69",
    /** Muted labels, footnotes */
    muted: "#9A9A9A",
    /** Gold accent — dividers, highlights */
    gold: "#B08A42",
    /** Hairline borders and dividers */
    border: "#E9E6E1",
    /** Page background */
    background: "#FFFFFF",
    /** Soft tint for image frames, subtle cards */
    soft: "#FAF8F5",
    /** Success / positive indicator */
    success: "#3F5E4D",
  },

  spacing: {
    xs: 4,
    sm: 8,
    base:12,
    md: 16,
    lg: 24,
    xl: 36,
    xxl: 52,
  },

  radius: {
    sm: 4,
    md: 8,
  },

  typography: {
    /** Serif headings — "Bodoni Moda" when registered, falls back to serif */
    heading: "Bodoni Moda",
    /** Sans-serif body — "DM Sans" when registered, falls back to sans-serif */
    body: "DM Sans",
    sizes: {
      xs: 8,
      sm: 9,
      base: 11,
      md: 10,
      mdSemibold: 13,
      lg: 12,
      xl: 18,
      total: 20,
      display: 22,
      xxl: 36,
    },
  },
} as const

/** Company / legal constants — single source for Header + Footer */
export const COMPANY = {
  displayName: "Infinytree",
  legalName: "Deltalivings Kft.",
  address: ["1065 Budapest", "Podmaniczky utca 19", "Hungary"],
  taxNumber: "32214460-2-42",
  site: "www.infinytree.com",
  email: "info@infinytree.com",
  tagline:
    "Every Infinytree piece is carefully handcrafted to bring timeless elegance into exceptional interiors.",
} as const
