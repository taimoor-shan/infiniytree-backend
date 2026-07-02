import { useRef, useState, type DragEvent } from "react"
import { Button, Input, Text, toast } from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/client"

type UploadResponse = {
  files?: Array<{ url?: string; location?: string }>
  file?: { url?: string; location?: string }
  url?: string
  location?: string
}

type ImageUploadProps = {
  value: string
  onChange: (value: string) => void
}

const ImageUpload = ({ value, onChange }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      return sdk.admin.upload.create(
        {
          files: [file],
        },
        undefined,
        {
          // Ensure browser sets multipart boundary correctly.
          "content-type": null,
        }
      ) as Promise<any>
    },
    onSuccess: (data) => {
      const url =
        data?.files?.[0]?.url ||
        data?.files?.[0]?.location ||
        data?.file?.url ||
        data?.file?.location ||
        data?.url ||
        data?.location

      if (!url) {
        toast.error("Upload succeeded but no URL was returned.")
        return
      }

      onChange(url)
      toast.success("Image uploaded")
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to upload image")
    },
  })

  const handleFile = (file?: File | null) => {
    if (!file) {
      return
    }
    uploadImage.mutate(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  const handleBrowse = () => {
    inputRef.current?.click()
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div
        className={[
          "flex flex-col items-center justify-center gap-y-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
          isDragging ? "border-ui-border-interactive bg-ui-bg-subtle" : "border-ui-border-base",
        ].join(" ")}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Drag and drop an image here, or upload a file.
        </Text>
        <Button
          size="small"
          variant="secondary"
          type="button"
          onClick={handleBrowse}
          disabled={uploadImage.isPending}
          isLoading={uploadImage.isPending}
        >
          Upload image
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      <div className="flex flex-col gap-y-2">
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Or paste an image URL
        </Text>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://..."
        />
      </div>

      {value && (
        <div className="flex items-center gap-x-3">
          <img
            src={value}
            alt="Featured preview"
            className="h-12 w-12 rounded-md border border-ui-border-base object-cover"
          />
          <Button
            size="small"
            variant="secondary"
            type="button"
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}

export default ImageUpload
