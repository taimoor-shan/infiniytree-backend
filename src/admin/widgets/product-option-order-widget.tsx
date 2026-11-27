import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { ArrowDownMini, ArrowUpMini, DotsSix } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Text,
  toast,
} from "@medusajs/ui"
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../lib/client"
import {
  OPTION_ORDER_KEY,
  type OrderOption,
  moveItem,
  optionOrderChanges,
  sortProductOptions,
} from "../lib/option-order"

const FIELDS = "id,metadata,*options,*options.values"

type ProductOptions = {
  options: OrderOption[]
  metadata: Record<string, unknown> | null
}

/** The product's options with each value's rank, which the page's own data may leave out. */
const useProductOptions = (productId: string) =>
  useQuery({
    queryKey: ["products", productId, "option-order"],
    queryFn: async (): Promise<ProductOptions> => {
      const { product } = await sdk.admin.product.retrieve(productId, {
        fields: FIELDS,
      })
      return {
        metadata: (product.metadata ?? null) as Record<string, unknown> | null,
        options: (product.options ?? []).map((option) => ({
          id: option.id,
          title: option.title,
          is_exclusive: (option as { is_exclusive?: boolean }).is_exclusive,
          values: (option.values ?? []).map((value) => ({
            id: value.id,
            value: value.value,
            rank: (value as { rank?: number | null }).rank ?? null,
          })),
        })),
      }
    },
  })

/** One row that can be dragged by its handle, or moved with the arrows. */
const SortableRow = ({
  id,
  label,
  index,
  count,
  onMove,
  children,
  strong = false,
}: {
  id: string
  label: string
  index: number
  count: number
  onMove: (from: number, to: number) => void
  children?: React.ReactNode
  strong?: boolean
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-ui-bg-base relative ${isDragging ? "z-10 shadow-elevation-card-hover" : ""}`}
    >
      <div className="flex items-center gap-x-2 py-2">
        <IconButton
          ref={setActivatorNodeRef}
          size="small"
          variant="transparent"
          type="button"
          className="cursor-grab active:cursor-grabbing"
          aria-label={`Drag ${label}`}
          {...attributes}
          {...listeners}
        >
          <DotsSix />
        </IconButton>
        <Text
          size="small"
          leading="compact"
          weight={strong ? "plus" : "regular"}
          className="min-w-0 flex-1 break-words"
        >
          {label}
        </Text>
        <IconButton
          size="small"
          variant="transparent"
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          aria-label={`Move ${label} up`}
        >
          <ArrowUpMini />
        </IconButton>
        <IconButton
          size="small"
          variant="transparent"
          type="button"
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
          aria-label={`Move ${label} down`}
        >
          <ArrowDownMini />
        </IconButton>
      </div>
      {children}
    </li>
  )
}

/** A list whose items are reordered by dragging. */
const SortableList = <T extends { id: string }>({
  items,
  onChange,
  renderItem,
  className,
}: {
  items: T[]
  onChange: (items: T[]) => void
  renderItem: (item: T, index: number, move: (from: number, to: number) => void) => React.ReactNode
  className?: string
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const move = (from: number, to: number) => onChange(moveItem(items, from, to))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(
      items.findIndex((item) => item.id === active.id),
      items.findIndex((item) => item.id === over.id)
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>{items.map((item, index) => renderItem(item, index, move))}</ul>
      </SortableContext>
    </DndContext>
  )
}

const OptionOrderBox = ({ product }: { product: HttpTypes.AdminProduct }) => {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useProductOptions(product.id)

  const saved = useMemo(
    () => (data ? sortProductOptions(data.options, data.metadata) : []),
    [data]
  )
  const [shown, setShown] = useState<OrderOption[]>(saved)
  useEffect(() => setShown(saved), [saved])

  const changes = useMemo(
    () => (data ? optionOrderChanges(shown, data) : { optionOrder: null, ranks: [] }),
    [shown, data]
  )
  const dirty = useMemo(
    () =>
      shown.map((o) => `${o.id}:${o.values.map((v) => v.id).join(",")}`).join("|") !==
      saved.map((o) => `${o.id}:${o.values.map((v) => v.id).join(",")}`).join("|"),
    [shown, saved]
  )

  const save = useMutation({
    mutationFn: async () => {
      for (const { optionId, ranks } of changes.ranks) {
        await sdk.admin.productOption.update(optionId, { ranks } as any)
      }
      // Saved on every change, also when only values moved: the product update
      // is what tells the storefront to refresh its copy of the product.
      await sdk.admin.product.update(product.id, {
        metadata: { [OPTION_ORDER_KEY]: shown.map((option) => option.id) },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product_options"] })
      toast.success("Option order saved")
    },
    onError: (error: Error) => {
      toast.error("Could not save the option order", { description: error.message })
    },
  })

  const setValues = (optionId: string, values: OrderOption["values"]) =>
    setShown((current) =>
      current.map((option) => (option.id === optionId ? { ...option, values } : option))
    )

  if (isLoading) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        Loading options…
      </Text>
    )
  }
  if (isError) {
    return (
      <Text size="small" className="text-ui-fg-error">
        The options could not be loaded.
      </Text>
    )
  }
  if (shown.length === 0) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        This product has no options yet. Add them in the Options section above.
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      <SortableList
        items={shown}
        onChange={setShown}
        className="divide-ui-border-base flex flex-col divide-y rounded-md border"
        renderItem={(option, index, move) => (
          <SortableRow
            key={option.id}
            id={option.id}
            label={option.title}
            index={index}
            count={shown.length}
            onMove={move}
            strong
          >
            <div className="pb-3 pl-10 pr-2">
              {option.is_exclusive === false && (
                <Badge size="2xsmall" className="mb-2">
                  Shared option: its value order applies to every product that uses it
                </Badge>
              )}
              <SortableList
                items={option.values}
                onChange={(values) => setValues(option.id, values)}
                className="divide-ui-border-base flex flex-col divide-y rounded-md border px-2"
                renderItem={(value, valueIndex, moveValue) => (
                  <SortableRow
                    key={value.id}
                    id={value.id}
                    label={value.value}
                    index={valueIndex}
                    count={option.values.length}
                    onMove={moveValue}
                  />
                )}
              />
            </div>
          </SortableRow>
        )}
      />
      <div className="flex items-center justify-end gap-x-2">
        <Button
          size="small"
          variant="secondary"
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => setShown(saved)}
        >
          Reset
        </Button>
        <Button
          size="small"
          type="button"
          disabled={!dirty}
          isLoading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save order
        </Button>
      </div>
    </div>
  )
}

/**
 * The order of the product's options and their values on the storefront:
 * drag them (or use the arrows). The storefront lists them in this order in the
 * buy box, opens on the first variant in it and shows the pictures in it.
 */
const ProductOptionOrderWidget = ({
  data: product,
}: DetailWidgetProps<HttpTypes.AdminProduct>) => (
  <Container className="flex flex-col gap-y-4 p-6">
    <div className="flex flex-col gap-y-1">
      <Heading level="h2">Option order</Heading>
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        Drag the options and their values into the order the storefront should
        use. The product page lists them in this order, opens on the first
        variant and shows the pictures of each variant in this order.
      </Text>
    </div>
    <OptionOrderBox product={product} />
  </Container>
)

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductOptionOrderWidget
