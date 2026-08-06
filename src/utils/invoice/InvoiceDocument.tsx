/**
 * InvoiceDocument — main PDF document composing all components.
 *
 * This is the ONLY file that knows about the full page layout.
 * Components receive pre-formatted data via InvoiceViewModel — the PDF
 * is a pure renderer with no business logic.
 *
 * Exports:
 * - InvoiceDocument (React component, used via React.createElement)
 * - generateInvoiceBuffer (async, returns PDF Buffer — called by API routes)
 */

import React from "react";

// Font registration side-effect — must import before any rendering
import "./fonts";

import { Document, Page, View, renderToBuffer } from "./react-pdf";
import { s } from "./styles";
import { getBankDetails } from "../bank-details";
import { mapOrderToInvoice } from "./mapper";
import { Header } from "./Header";
import { BillingDetails } from "./BillingDetails";
import { ProductTable } from "./ProductTable";
import { TotalsCard } from "./TotalsCard";
import { PaymentInformation } from "./PaymentInformation";
import { Footer } from "./Footer";
import type { InvoiceOrderData, InvoiceViewModel } from "./types";

// ---------------------------------------------------------------------------
// Re-export the raw-data type (backward compat — API routes import this)
// ---------------------------------------------------------------------------

export type { InvoiceOrderData } from "./types";

// ---------------------------------------------------------------------------
// Document component
// ---------------------------------------------------------------------------

export function InvoiceDocument({ invoice }: { invoice: InvoiceViewModel }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header
          invoiceNumber={invoice.invoiceNumber}
          orderNumber={invoice.orderNumber}
          issueDate={invoice.issueDate}
          dueDate={invoice.dueDate}
        />
        <View style={s.financialSection}>
          <View style={s.financialLeft}>
            <BillingDetails {...invoice.billing} />
          </View>
          <View style={s.financialRight}>
            <PaymentInformation {...invoice.payment} />
          </View>
        </View>

        <ProductTable items={invoice.items} />

        {/* Payment + Totals side-by-side */}

            <TotalsCard {...invoice.totals} />

        <Footer />
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// PDF buffer generator (called by API routes)
// ---------------------------------------------------------------------------

export async function generateInvoiceBuffer(
  order: InvoiceOrderData,
): Promise<Buffer> {
  const displayId = (order.display_id || order.id?.slice(-8) || "—").toString();
  const bankDetails = getBankDetails(displayId);
  const invoice = mapOrderToInvoice(order, bankDetails);

  return renderToBuffer(
    React.createElement(InvoiceDocument, {
      invoice,
    }) as unknown as React.ReactElement,
  );
}
