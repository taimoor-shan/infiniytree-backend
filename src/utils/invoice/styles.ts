/**
 * Shared styles for the Infinytree invoice PDF.
 *
 * Design philosophy: luxury through whitespace, not boxes.
 * No filled backgrounds except the soft image frame and subtle totals card.
 */

import { StyleSheet } from "./react-pdf"
import { theme } from "./theme"

const { colors, spacing, typography } = theme

export const s = StyleSheet.create({
  // -----------------------------------------------------------------------
  // Page
  // -----------------------------------------------------------------------

  page: {
    paddingTop: 34,
    paddingBottom: 30,
    paddingHorizontal: 44,
    backgroundColor: colors.background,
    fontFamily: typography.body,
    fontSize: typography.sizes.md,
    color: colors.primary,
    lineHeight: 1.6,
  },

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  divider: {
    borderBottom: `1pt solid ${colors.border}`,
    marginVertical: 16,
  },

  section: {
    marginBottom: 16,
  },

  sectionCompact: {
    marginBottom: 16,
  },

  // -----------------------------------------------------------------------
  // Typography
  // -----------------------------------------------------------------------

  title: {
    fontFamily: typography.heading,
    fontSize: typography.sizes.xxl,
    letterSpacing: 1,
    color: colors.primary,
  },

  subtitle: {
    fontSize: typography.sizes.md,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.gold,
  },

  sectionHeading: {
    fontFamily: typography.heading,
    fontSize: 16,
    fontWeight:"bold",
    marginBottom: 20,
  },
  
  company: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.body,
    fontWeight: "bold",
    marginTop: 2,
    marginBottom: 2,
  },

  companyLegal: {
    fontSize: typography.sizes.lg,
    color: colors.secondary,
    marginBottom: 2,
  },

  body: {
    fontSize: typography.sizes.md,
    color: colors.secondary,
  },

  label: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  value: {
    fontSize: typography.sizes.base ?? 11,
    color: colors.primary,
  },

  strong: {
    fontWeight: "bold",
  },

  small: {
    fontSize: typography.sizes.sm,
    color: colors.secondary,
  },

  total: {
    // fontFamily: typography.heading,
    fontSize: 16,
  },

  // -----------------------------------------------------------------------
  // Header
  // -----------------------------------------------------------------------

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },

  companyColumn: {
    width: "44%",
  },

  invoiceColumn: {
    width: "36%",
  },

  logoImage: {
    width: "160",
    height: "50",
    objectFit: "contain",
    marginBottom: 10,
  },

  invoiceTitle: {
    fontFamily: typography.heading,
    fontSize: 16,
    fontWeight:600,
    letterSpacing: 0.3,
    marginBottom: 8,
     marginTop: 8,
  },

  goldDivider: {
    width: 48,
    borderBottom: `2pt solid ${colors.gold}`,
    marginBottom: 14,
  },

  metaTable: {
    width: "100%",
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },

  metaLabel: {
    color: "#777",
    fontSize: typography.sizes.sm,
  },

  metaValue: {
    fontSize: typography.sizes.sm ?? 8,
    fontWeight: "bold",
    color: colors.primary,
  },

  pageDivider: {
    borderBottom: `1pt solid ${colors.border}`,
    marginBottom: 6,
  },

  // -----------------------------------------------------------------------
  // Billing Details (Customer)
  // -----------------------------------------------------------------------

  // billToWrapper: {
  //   maxWidth: "55%",
  // },

  // customerCard: {
  //   paddingBottom: 10,
  //   borderBottom: `1pt solid ${colors.border}`,
  // },

  customerCompany: {
    fontWeight: "bold",
    fontSize: typography.sizes.lg,
    marginBottom: 4,
  },

  customerName: {
    fontSize: typography.sizes.lg,
    marginBottom: 6,
  },

  vatRow: {
    marginTop: 8,
  },

  vatValue: {
    fontWeight: "bold",
    marginTop: 4,
  },

  // -----------------------------------------------------------------------
  // Product Table
  // -----------------------------------------------------------------------

  productRow: {
    flexDirection: "row",
    // alignItems: "center",
    paddingVertical: 10,
    borderBottom: `1pt solid #ECECEC`,
    borderTop: `1pt solid #ECECEC`,
  },

  productImage: {
    width: 54,
    height: 54,
    padding: 4,
    backgroundColor: colors.soft,
    border: `1pt solid ${colors.border}`,
    borderRadius: 6,
    objectFit: "contain",
    marginRight: 10,
  },

  productInfo: {
    flex: 3,
    paddingRight: 20,
  },

  productTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: "bold",
    marginBottom: 2,
  },

  productSubtitle: {
    color: "#777",
    fontSize: typography.sizes.sm,
  },

  productSku: {
    color: colors.muted,
    fontSize: typography.sizes.xs,
    marginTop: 0,
  },

  qtyColumn: {
    width: 34,
    alignItems: "center",
  },

  priceColumn: {
    width: 68,
    alignItems: "flex-end",
  },

  totalColumn: {
    width: 82,
    alignItems: "flex-end",
  },

  columnLabel: {
    fontSize: typography.sizes.xs,
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 4,
  },

  columnValue: {
    fontSize: typography.sizes.base ?? 11,
  },

  productTotal: {
    fontWeight: "bold",
    fontSize: typography.sizes.lg,
  },

  // -----------------------------------------------------------------------
  // Totals Card
  // -----------------------------------------------------------------------



  summaryWrapper: {
    display:'flex',
    alignItems: "flex-end",
    marginTop: 0,
    marginBottom: 0,
  },

  summaryCard: {
    width: 220,
    border: `1pt solid ${colors.border}`,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FCFBF9",
  },

  summaryHeading: {
    fontFamily: typography.heading,
    fontSize: typography.sizes.lg,
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },

  summaryLabel: {
    fontSize: typography.sizes.md,
    color: colors.secondary,
  },

  summaryValue: {
    fontSize: typography.sizes.md,
    color: colors.primary,
  },

  summaryLabelStrong: {
    fontWeight: "bold",
    fontSize: typography.sizes.mdSemibold ?? 13,
  },

  summaryValueStrong: {
    fontFamily: typography.heading,
    fontSize: typography.sizes.display ?? 22,
  },

  summaryDivider: {
    borderBottom: `1pt solid #E5E5E5`,
    marginVertical: 4,
  },

  vatNote: {
    marginTop: 8,
    color: "#8A8A8A",
    fontSize: typography.sizes.xs,
    lineHeight: 1.5,
  },

  // -----------------------------------------------------------------------
  // Payment Information
  // -----------------------------------------------------------------------

  paymentSection: {
    marginTop: 0,
  },

  paymentCard: {
    border: `1pt solid ${colors.border}`,
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.background,
  },

  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 3,
    borderBottom: `0.25pt solid #E9E6E1`,
  },

  paymentLabel: {
    width: 72,
    color: "#777",
    fontSize: typography.sizes.sm,
  },

  paymentValue: {
    flex: 1,
    textAlign: "right",
    fontSize: typography.sizes.md,
    color: colors.primary,
  },

  // -----------------------------------------------------------------------
  // Financial Section (Payment + Totals side-by-side)
  // -----------------------------------------------------------------------

  financialSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginTop: 14,
    marginBottom: 14,
  },

  financialLeft: {
    width: "48%",
  },

  financialRight: {
    width: "48%",
  },

  // -----------------------------------------------------------------------
  // Footer
  // -----------------------------------------------------------------------

  footer: {
    marginTop: 10,
  },

  footerDivider: {
    borderBottom: `1pt solid ${colors.border}`,
    marginBottom: 14,
    marginTop:10,
  },

  footerHeading: {
    fontFamily: typography.heading,
    fontSize:16,
    marginBottom: 10,
    textAlign:'center'
  },

  footerText: {
    fontSize: 10,
    color: colors.secondary,
    lineHeight: 1.6,
    marginBottom: 6,
    // maxWidth: "65%",
    // marginLeft: "auto",
    // marginRight: "auto",
    textAlign:'center'
    
  },

  footerLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },

  footerLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
  },

  footerDot: {
    marginHorizontal: 10,
    color: colors.gold,
  },

  footerCompany: {
    textAlign: "center",
    color: "#777",
    fontSize: typography.sizes.xs,
    marginBottom: 4,
  },

  footerSmall: {
    textAlign: "center",
    color: "#999",
    fontSize: typography.sizes.xs,
  },
})