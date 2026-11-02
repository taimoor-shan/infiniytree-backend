import { CloneDashed } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/framework/types"
import { Button, Drawer, Input, Label, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { useNavigate } from "react-router-dom"
import { sdk } from "../lib/client"
import { copyAddress, suggestedCopyTitle } from "../lib/duplicate-product"

type DuplicateResponse = {
  product: { id: string; title: string; handle: string; status: string }
}

// The longest title the server accepts (`DuplicateProductSchema`).
const TITLE_MAX_LENGTH = 255

/**
 * "Duplicate" for a product: asks for the new product's title, has the server
 * make a draft copy of everything else (`POST /admin/products/:id/duplicate`),
 * and opens the copy. The address follows the title; the server adds a number
 * to it when it is taken.
 */
export const DuplicateProduct = ({
  product,
}: {
  product: HttpTypes.AdminProduct
}) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")

  const duplicate = useMutation({
    mutationFn: (copyTitle: string) =>
      sdk.client.fetch<DuplicateResponse>(
        `/admin/products/${product.id}/duplicate`,
        { method: "POST", body: { title: copyTitle } }
      ),
    onSuccess: ({ product: copy }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setOpen(false)
      toast.success("Draft created", {
        description: `"${copy.title}" is saved as a draft. Check it, then publish it.`,
      })
      navigate(`/products/${copy.id}`)
      // The admin scrolls inside <main> and keeps its offset from page to page,
      // and this button sits at the end of the page: open the copy at its top.
      document.querySelector("main")?.scrollTo({ top: 0 })
    },
    onError: (error: Error) => {
      toast.error("Could not duplicate the product", {
        description: error.message,
      })
    },
  })

  const onOpenChange = (next: boolean) => {
    // Once the copy is on its way, the dialog stays until it has been made.
    if (duplicate.isPending) {
      return
    }
    if (next) {
      setTitle(suggestedCopyTitle(product.title))
    }
    setOpen(next)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const copyTitle = title.trim()
    if (copyTitle && !duplicate.isPending) {
      duplicate.mutate(copyTitle)
    }
  }

  return (
    <>
      <Button
        size="small"
        variant="secondary"
        onClick={() => onOpenChange(true)}
        title="Makes a draft copy of this product under a new title."
      >
        <CloneDashed />
        Duplicate
      </Button>

      <Drawer open={open} onOpenChange={onOpenChange}>
        <Drawer.Content>
          <form
            onSubmit={onSubmit}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <Drawer.Header>
              <Drawer.Title>Duplicate product</Drawer.Title>
              <Drawer.Description>
                Makes a draft copy of "{product.title}".
              </Drawer.Description>
            </Drawer.Header>

            <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-auto p-4">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="duplicate-product-title" size="small" weight="plus">
                  Title of the copy
                </Label>
                <Input
                  id="duplicate-product-title"
                  autoFocus
                  value={title}
                  disabled={duplicate.isPending}
                  maxLength={TITLE_MAX_LENGTH}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <Text
                  size="small"
                  leading="compact"
                  className="break-words text-ui-fg-subtle"
                >
                  Its address will be /{copyAddress(title)}. A number is added to
                  it if that address is already taken.
                </Text>
              </div>

              <div className="flex flex-col gap-y-2">
                <Text size="small" leading="compact" weight="plus">
                  What the copy gets
                </Text>
                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                  It is saved as a draft, so it stays off the storefront until
                  you publish it. Everything else is copied: the texts, pictures
                  and video, options, variants with their prices, categories,
                  tags, shipping class and the translations.
                </Text>
                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                  Not copied: stock, SKUs and barcodes (each belongs to one
                  variant), sale prices, and the translated title, which names
                  the original. Translate the new title on the copy.
                </Text>
              </div>
            </Drawer.Body>

            <Drawer.Footer>
              <div className="flex items-center justify-end gap-x-2">
                <Drawer.Close asChild>
                  <Button
                    type="button"
                    size="small"
                    variant="secondary"
                    disabled={duplicate.isPending}
                  >
                    Cancel
                  </Button>
                </Drawer.Close>
                <Button
                  type="submit"
                  size="small"
                  isLoading={duplicate.isPending}
                  disabled={!title.trim()}
                >
                  Duplicate
                </Button>
              </div>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>
    </>
  )
}
