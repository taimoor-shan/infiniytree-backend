import { useEffect, useRef, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  ArrowUpTray,
  ArrowUturnLeft,
  Photo,
  PlaySolid,
  SquareTwoStack,
  Trash,
  DocumentText,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Select,
  Table,
  Tabs,
  Text,
  Tooltip,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/client"
import {
  MediaFile,
  MediaStats,
  MediaStatus,
  STATUS_HELP,
  STATUS_LABEL,
  TrashItem,
  describeUsage,
  displayName,
  formatBytes,
  isImage,
  isVideo,
  summarizeUsages,
} from "../../lib/media"

type MediaResponse = {
  files: MediaFile[]
  count: number
  limit: number
  offset: number
  stats: MediaStats
  settings: { mode: "off" | "report" | "trash"; min_age_days: number; trash_retention_days: number }
  scanned_at: string
}

type TrashResponse = { items: TrashItem[]; count: number; retention_days: number }

const MEDIA_KEY = "media-library"
const TRASH_KEY = "media-trash"
const PAGE_SIZE = 25

const STATUS_COLOR: Record<MediaStatus, "green" | "orange" | "blue" | "grey"> = {
  used: "green",
  unused: "orange",
  recent: "blue",
  protected: "grey",
}

const date = (value: string) => new Date(value).toLocaleDateString()

const Preview = ({ file }: { file: { name: string; url?: string } }) => {
  const box = "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-ui-bg-subtle"
  if (file.url && isImage(file.name)) {
    return (
      <a href={file.url} target="_blank" rel="noreferrer" className={box}>
        <img src={file.url} alt="" loading="lazy" className="h-full w-full object-cover" />
      </a>
    )
  }
  const Icon = isVideo(file.name) ? PlaySolid : isImage(file.name) ? Photo : DocumentText
  return (
    <span className={box}>
      <Icon className="text-ui-fg-muted" />
    </span>
  )
}

/** What an empty table shows: loading, a failed request with Retry, or the empty text. */
const EmptyRow = ({
  colSpan,
  query,
  empty,
  loading,
}: {
  colSpan: number
  query: { isPending: boolean; isError: boolean; refetch: () => unknown }
  empty: string
  loading: string
}) => (
  <Table.Row>
    <td colSpan={colSpan} className="px-6">
      <div className="flex flex-col items-center gap-2 py-6">
        <Text size="small" className={query.isError ? "text-ui-fg-error" : "text-ui-fg-subtle"}>
          {query.isError ? "This list could not be loaded." : query.isPending ? loading : empty}
        </Text>
        {query.isError && (
          <Button size="small" variant="secondary" onClick={() => query.refetch()}>
            Retry
          </Button>
        )}
      </div>
    </td>
  </Table.Row>
)

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="flex flex-col gap-1 rounded-lg border px-4 py-3">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text weight="plus" size="large">
      {value}
    </Text>
    {hint && (
      <Text size="xsmall" className="text-ui-fg-muted">
        {hint}
      </Text>
    )}
  </div>
)

const MediaRoute = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const uploadInput = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState("files")
  const [status, setStatus] = useState<"all" | MediaStatus>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const media = useQuery({
    queryKey: [MEDIA_KEY, status, search, page],
    queryFn: () =>
      sdk.client.fetch<MediaResponse>("/admin/media", {
        query: {
          status,
          q: search || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
    placeholderData: (prev: MediaResponse | undefined) => prev,
  })

  const trash = useQuery({
    queryKey: [TRASH_KEY],
    queryFn: () => sdk.client.fetch<TrashResponse>("/admin/media/trash"),
  })

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: [MEDIA_KEY] })
    queryClient.invalidateQueries({ queryKey: [TRASH_KEY] })
  }

  const onError = (error: any) => toast.error(error?.message || "Something went wrong")

  const rescan = useMutation({
    mutationFn: () => sdk.client.fetch("/admin/media", { query: { refresh: true, limit: 1 } }),
    onSuccess: refreshAll,
    onError,
  })

  const upload = useMutation({
    mutationFn: (files: File[]) => sdk.admin.upload.create({ files }),
    onSuccess: (_, files) => {
      toast.success(files.length === 1 ? "File uploaded" : `${files.length} files uploaded`)
      return sdk.client
        .fetch("/admin/media", { query: { refresh: true, limit: 1 } })
        .then(refreshAll)
    },
    onError,
  })

  const moveToTrash = useMutation({
    mutationFn: (names: string[]) =>
      sdk.client.fetch<{ moved: TrashItem[]; refused: { name: string; reason: string }[] }>(
        "/admin/media/trash",
        { method: "POST", body: { names } }
      ),
    onSuccess: (result) => {
      refreshAll()
      if (result.moved.length) toast.success("Moved to the trash")
      const inUse = result.refused.filter((r) => r.reason === "in_use")
      if (inUse.length) toast.error("This file is in use now and was not moved.")
    },
    onError,
  })

  const restore = useMutation({
    mutationFn: (ids: string[]) =>
      sdk.client.fetch<{ restored: string[]; conflicts: string[] }>(
        "/admin/media/trash/restore",
        { method: "POST", body: { ids } }
      ),
    onSuccess: (result) => {
      refreshAll()
      if (result.restored.length) toast.success("Restored")
      if (result.conflicts.length) {
        toast.error("A file with that name is already back in the library; nothing was overwritten.")
      }
    },
    onError,
  })

  const deleteForever = useMutation({
    mutationFn: (ids: string[]) =>
      sdk.client.fetch("/admin/media/trash/delete", { method: "POST", body: { ids } }),
    onSuccess: () => {
      refreshAll()
      toast.success("Deleted for good")
    },
    onError,
  })

  const cleanup = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ trashed: string[]; purged: string[] }>("/admin/media/cleanup", {
        method: "POST",
      }),
    onSuccess: (result) => {
      refreshAll()
      toast.success(
        result.trashed.length
          ? `Moved ${result.trashed.length} unused file(s) to the trash`
          : "Nothing to clean up"
      )
    },
    onError,
  })

  const stats = media.data?.stats
  const settings = media.data?.settings
  const files = media.data?.files || []
  const count = media.data?.count || 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  // After a file leaves the list (trash, cleanup) the current page can be past
  // the end: step back to the last page that exists.
  useEffect(() => {
    if (media.data && page > 0 && page >= pages) setPage(pages - 1)
  }, [media.data, page, pages])

  const confirmTrash = async (file: MediaFile) => {
    const ok = await prompt({
      title: "Move to the trash?",
      description: `${displayName(file.name)} stops loading on the site. You can restore it from the trash for ${
        settings?.trash_retention_days ?? 30
      } days.`,
      confirmText: "Move to trash",
      cancelText: "Cancel",
    })
    if (ok) moveToTrash.mutate([file.name])
  }

  const confirmCleanup = async () => {
    const ok = await prompt({
      title: "Clean up unused files?",
      description: `${stats?.unused_count ?? 0} unused file(s) (${formatBytes(
        stats?.unused_bytes ?? 0
      )}) go to the trash, where they stay restorable for ${
        settings?.trash_retention_days ?? 30
      } days. Files in use, new uploads and protected files are not touched.`,
      confirmText: "Clean up",
      cancelText: "Cancel",
    })
    if (ok) cleanup.mutate()
  }

  const confirmDelete = async (item: TrashItem) => {
    const ok = await prompt({
      title: "Delete for good?",
      description: `${displayName(item.name)} is removed from the server now. Only the off-site backup may still have it.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (ok) deleteForever.mutate([item.id])
  }

  const copyLink = async (file: MediaFile) => {
    await navigator.clipboard.writeText(file.url)
    toast.success("Link copied")
  }

  const modeText =
    settings?.mode === "trash"
      ? `Every night unused files older than ${settings.min_age_days} days go to the trash, and trash older than ${settings.trash_retention_days} days is deleted.`
      : settings?.mode === "off"
        ? "The nightly cleanup is switched off (MEDIA_CLEANUP_MODE=off)."
        : `The nightly cleanup only reports for now (MEDIA_CLEANUP_MODE=report). "Clean up now" moves unused files older than ${
            settings?.min_age_days ?? 7
          } days to the trash.`

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <Heading level="h1">Media</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Every picture, video and file uploaded to the shop, and where it is used.
          </Text>
        </div>
        <div className="flex gap-2">
          <input
            ref={uploadInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files || [])
              if (list.length) upload.mutate(list)
              e.target.value = ""
            }}
          />
          <Button
            size="small"
            variant="secondary"
            isLoading={rescan.isPending}
            onClick={() => rescan.mutate()}
          >
            <ArrowPath /> Rescan
          </Button>
          <Button
            size="small"
            variant="secondary"
            isLoading={cleanup.isPending}
            disabled={!stats?.unused_count}
            onClick={confirmCleanup}
          >
            <Trash /> Clean up now
          </Button>
          <Button
            size="small"
            isLoading={upload.isPending}
            onClick={() => uploadInput.current?.click()}
          >
            <ArrowUpTray /> Upload
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 py-4 lg:grid-cols-4">
        <Stat
          label="Files"
          value={stats ? String(stats.file_count) : "–"}
          hint={stats ? formatBytes(stats.total_bytes) : undefined}
        />
        <Stat
          label="Unused"
          value={stats ? String(stats.unused_count) : "–"}
          hint={stats ? formatBytes(stats.unused_bytes) : undefined}
        />
        <Stat
          label="In the trash"
          value={stats ? String(stats.trash_count) : "–"}
          hint={stats ? formatBytes(stats.trash_bytes) : undefined}
        />
        <Stat
          label="Free disk space"
          value={stats?.disk ? formatBytes(stats.disk.free_bytes) : "–"}
          hint={stats?.disk ? `of ${formatBytes(stats.disk.total_bytes)}` : undefined}
        />
        <Text size="small" className="col-span-full text-ui-fg-subtle">
          {modeText}
        </Text>
      </div>

      <div className="px-6 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            <Tabs.Trigger value="files">Files</Tabs.Trigger>
            <Tabs.Trigger value="trash">Trash ({trash.data?.count ?? 0})</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="files" className="pt-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="w-[200px]">
                <Select
                  size="small"
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v as any)
                    setPage(0)
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="all">All files</Select.Item>
                    <Select.Item value="used">In use</Select.Item>
                    <Select.Item value="unused">Unused</Select.Item>
                    <Select.Item value="recent">New</Select.Item>
                    <Select.Item value="protected">Protected</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="w-[260px]">
                <Input
                  size="small"
                  type="search"
                  placeholder="Search file name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                />
              </div>
            </div>

            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>File</Table.HeaderCell>
                  <Table.HeaderCell>Size</Table.HeaderCell>
                  <Table.HeaderCell>Uploaded</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Used by</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {files.map((file) => {
                  const first = file.usages[0] ? describeUsage(file.usages[0]) : null
                  return (
                    <Table.Row key={file.name}>
                      <Table.Cell>
                        <div className="flex items-center gap-3 py-1">
                          <Preview file={file} />
                          <span className="max-w-[260px] truncate" title={file.name}>
                            {displayName(file.name)}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>{formatBytes(file.size)}</Table.Cell>
                      <Table.Cell>{date(file.modified_at)}</Table.Cell>
                      <Table.Cell>
                        <Tooltip content={STATUS_HELP[file.status]}>
                          <Badge size="2xsmall" color={STATUS_COLOR[file.status]}>
                            {STATUS_LABEL[file.status]}
                          </Badge>
                        </Tooltip>
                      </Table.Cell>
                      <Table.Cell>
                        {first ? (
                          <span className="max-w-[240px] truncate" title={summarizeUsages(file.usages)}>
                            {first.href ? (
                              <a href={first.href} className="text-ui-fg-interactive hover:underline">
                                {summarizeUsages(file.usages)}
                              </a>
                            ) : (
                              summarizeUsages(file.usages)
                            )}
                          </span>
                        ) : (
                          <span className="text-ui-fg-muted">–</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex justify-end gap-1">
                          <IconButton
                            size="small"
                            variant="transparent"
                            aria-label={`Copy the link of ${displayName(file.name)}`}
                            onClick={() => copyLink(file)}
                          >
                            <SquareTwoStack />
                          </IconButton>
                          <IconButton
                            size="small"
                            variant="transparent"
                            aria-label={`Move ${displayName(file.name)} to the trash`}
                            disabled={file.status === "used" || file.status === "protected"}
                            onClick={() => confirmTrash(file)}
                          >
                            <Trash />
                          </IconButton>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
                {!files.length && (
                  <EmptyRow colSpan={6} query={media} loading="Scanning..." empty="No files match." />
                )}
              </Table.Body>
            </Table>
            <div className="flex items-center justify-between pt-3">
              <Text size="small" className="text-ui-fg-subtle">
                {count} file(s)
              </Text>
              <div className="flex items-center gap-2">
                <Button size="small" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Text size="small">
                  {page + 1} / {pages}
                </Text>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="trash" className="pt-4">
            <Text size="small" className="mb-3 text-ui-fg-subtle">
              Files in the trash no longer load on the site. Restore puts a file back at its old
              address; anything still pointing at it works again. Items are deleted for good after{" "}
              {trash.data?.retention_days ?? 30} days.
            </Text>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>File</Table.HeaderCell>
                  <Table.HeaderCell>Size</Table.HeaderCell>
                  <Table.HeaderCell>Moved to trash</Table.HeaderCell>
                  <Table.HeaderCell>Deleted on</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(trash.data?.items || []).map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-3 py-1">
                        <Preview file={{ name: item.name }} />
                        <span className="max-w-[300px] truncate" title={item.name}>
                          {displayName(item.name)}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{formatBytes(item.size)}</Table.Cell>
                    <Table.Cell>{date(item.trashed_at)}</Table.Cell>
                    <Table.Cell>{date(item.deletes_at)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Button size="small" variant="secondary" onClick={() => restore.mutate([item.id])}>
                          <ArrowUturnLeft /> Restore
                        </Button>
                        <IconButton
                          size="small"
                          variant="transparent"
                          aria-label={`Delete ${displayName(item.name)} for good`}
                          onClick={() => confirmDelete(item)}
                        >
                          <Trash />
                        </IconButton>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
                {!trash.data?.items.length && (
                  <EmptyRow colSpan={5} query={trash} loading="Loading..." empty="The trash is empty." />
                )}
              </Table.Body>
            </Table>
          </Tabs.Content>
        </Tabs>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Media",
  icon: Photo,
})

export default MediaRoute
