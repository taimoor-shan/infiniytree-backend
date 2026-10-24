import { FocusModal } from "@medusajs/ui"

/**
 * The title a full-screen editor needs for screen readers, kept off the screen.
 *
 * `FocusModal.Title` discards a `className`, so `className="sr-only"` on it does
 * nothing and the text shows up unstyled in the corner. The class goes on a
 * child that the title renders as (`asChild`), as the dashboard itself does.
 */
const HiddenTitle = ({ children }: { children: React.ReactNode }) => (
  <FocusModal.Title asChild>
    <span className="sr-only">{children}</span>
  </FocusModal.Title>
)

export default HiddenTitle
