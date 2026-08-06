/**
 * ProductTable — luxury retail order summary with product thumbnails.
 *
 * Each product row is self-contained (no spreadsheet-style header row).
 * Images use a soft framed placeholder when no thumbnail is available.
 */

import React from "react"
import { View, Text, Image } from "./react-pdf"
import { s } from "./styles"
import type { LineItem } from "./types"

export function ProductTable({ items }: { items: LineItem[] }) {
  if (!items || items.length === 0) return null

  return (
    <View style={s.section}>
      <Text style={s.sectionHeading}>Order Summary</Text>

      {items.map((item, index) => (
        <View key={index} style={s.productRow}>
          {/* Product thumbnail */}
          {/* <Image
            src={item.image || undefined}
            style={s.productImage}
          /> */}

          {/* Product info */}
          <View style={s.productInfo}>
            <Text style={s.productTitle}>{item.title}</Text>
            {item.subtitle ? (
              <Text style={s.productSubtitle}>{item.subtitle}</Text>
            ) : null}
            {item.sku ? (
              <Text style={s.productSku}>{item.sku}</Text>
            ) : null}
          </View>

          {/* Qty */}
          <View style={s.qtyColumn}>
            <Text style={s.columnLabel}>Qty</Text>
            <Text style={s.columnValue}>{item.quantity}</Text>
          </View>

          {/* Unit Price */}
          <View style={s.priceColumn}>
            <Text style={s.columnLabel}>Unit Price</Text>
            <Text style={s.columnValue}>{item.unitPrice}</Text>
          </View>

          {/* Total */}
          <View style={s.totalColumn}>
            <Text style={s.columnLabel}>Total</Text>
            <Text style={s.productTotal}>{item.total}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
