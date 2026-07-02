import { useCallback, useEffect, useState } from "react"
import { Button, Input, Text } from "@medusajs/ui"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import Underline from "@tiptap/extension-underline"

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
}

const RichTextEditor = ({ value, onChange }: RichTextEditorProps) => {
  const [linkUrl, setLinkUrl] = useState("")
  const [showLinkInput, setShowLinkInput] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener" },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Underline,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "rte min-h-[160px] outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || "", false)
    }
  }, [editor, value])

  const addLink = useCallback(() => {
    if (!editor || !linkUrl) return
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: linkUrl })
      .run()
    setLinkUrl("")
    setShowLinkInput(false)
  }, [editor, linkUrl])

  const removeLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().unsetLink().run()
  }, [editor])

  if (!editor) {
    return (
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        Loading editor...
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-y-2">
      <style>
        {`
          .rte {
            white-space: pre-wrap;
          }
          .rte p {
            margin: 0 0 0.75rem;
          }
          .rte h1 {
            font-size: 1.5rem;
            font-weight: 700;
            margin: 1.5rem 0 0.75rem;
          }
          .rte h2 {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 1rem 0 0.5rem;
          }
          .rte h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0.75rem 0 0.5rem;
          }
          .rte h4 {
            font-size: 1rem;
            font-weight: 600;
            margin: 0.5rem 0 0.5rem;
          }
          .rte ul,
          .rte ol {
            padding-left: 1.5rem;
            margin: 0 0 0.75rem;
          }
          .rte ul {
            list-style: disc;
          }
          .rte ol {
            list-style: decimal;
          }
          .rte a {
            color: #3b82f6;
            text-decoration: underline;
            cursor: pointer;
          }
          .rte hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 1.5rem 0;
          }
          .rte table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.75rem 0;
          }
          .rte th,
          .rte td {
            border: 1px solid #e5e7eb;
            padding: 0.5rem 0.75rem;
            text-align: left;
          }
          .rte th {
            background: #f9fafb;
            font-weight: 600;
          }
          .rte u {
            text-decoration: underline;
          }
        `}
      </style>

      {/* Row 1: Text formatting */}
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="small"
          variant={editor.isActive("bold") ? "primary" : "secondary"}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </Button>
        <Button
          type="button"
          size="small"
          variant={editor.isActive("italic") ? "primary" : "secondary"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </Button>
        <Button
          type="button"
          size="small"
          variant={editor.isActive("underline") ? "primary" : "secondary"}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </Button>

        <div className="w-px bg-ui-border-base mx-1" />

        <Button
          type="button"
          size="small"
          variant={
            editor.isActive("heading", { level: 1 }) ? "primary" : "secondary"
          }
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          H1
        </Button>
        <Button
          type="button"
          size="small"
          variant={
            editor.isActive("heading", { level: 2 }) ? "primary" : "secondary"
          }
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </Button>
        <Button
          type="button"
          size="small"
          variant={
            editor.isActive("heading", { level: 3 }) ? "primary" : "secondary"
          }
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </Button>

        <div className="w-px bg-ui-border-base mx-1" />

        <Button
          type="button"
          size="small"
          variant={editor.isActive("bulletList") ? "primary" : "secondary"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </Button>
        <Button
          type="button"
          size="small"
          variant={editor.isActive("orderedList") ? "primary" : "secondary"}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </Button>

        <div className="w-px bg-ui-border-base mx-1" />

        <Button
          type="button"
          size="small"
          variant="secondary"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          ― HR
        </Button>
        <Button
          type="button"
          size="small"
          variant={editor.isActive("link") ? "primary" : "secondary"}
          onClick={() => {
            if (editor.isActive("link")) {
              removeLink()
            } else {
              setShowLinkInput(!showLinkInput)
            }
          }}
        >
          🔗 Link
        </Button>
        <Button
          type="button"
          size="small"
          variant="secondary"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
              .run()
          }
        >
          ☷ Table
        </Button>
      </div>

      {/* Link input */}
      {showLinkInput && (
        <div className="flex gap-2 items-center">
          <Input
            size="small"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addLink()
              }
            }}
          />
          <Button type="button" size="small" onClick={addLink}>
            Apply
          </Button>
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={() => {
              setShowLinkInput(false)
              setLinkUrl("")
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="rounded-md border border-ui-border-base bg-ui-bg-base p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export default RichTextEditor
