import { Text } from "@medusajs/ui"

/** A labelled form field with an optional hint and character counter. */
export const Field = ({
  label,
  hint,
  counter,
  children,
}: {
  label: string
  hint?: string
  counter?: { value: number; max: number }
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-y-2">
    <div className="flex items-center justify-between">
      <Text size="small" leading="compact" weight="plus">
        {label}
      </Text>
      {counter && (
        <Text
          size="small"
          leading="compact"
          className={
            counter.value > counter.max
              ? "text-ui-fg-error"
              : "text-ui-fg-subtle"
          }
        >
          {counter.value}/{counter.max}
        </Text>
      )}
    </div>
    {children}
    {hint && (
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        {hint}
      </Text>
    )}
  </div>
)

/** A titled card, used for the editor's sidebar sections. */
export const Box = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
    <Text size="small" leading="compact" weight="plus">
      {title}
    </Text>
    {children}
  </div>
)
