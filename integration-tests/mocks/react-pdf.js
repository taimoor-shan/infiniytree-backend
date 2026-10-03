/**
 * Jest stand-in for @react-pdf/renderer.
 *
 * The package is ESM-only. The app loads it through Node's require(esm), which
 * jest's module system does not support, so API routes that import the invoice
 * renderer fail to register under jest. Integration tests never render
 * invoices; this stub only lets those routes load.
 */
const Noop = () => null

module.exports = {
  Document: Noop,
  Page: Noop,
  Text: Noop,
  View: Noop,
  Image: Noop,
  StyleSheet: { create: (styles) => styles },
  Font: { register: () => {}, registerHyphenationCallback: () => {} },
  renderToBuffer: async () => Buffer.from(""),
}
