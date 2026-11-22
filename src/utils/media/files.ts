import fs from "fs/promises"
import { constants as fsConstants } from "fs"
import path from "path"

/**
 * The upload folder and its trash, on disk.
 *
 * Names are paths relative to the folder with forward slashes, exactly as they
 * appear after `/static/` in a URL. Every name that comes from a request goes
 * through `resolveInside`, so nothing outside the two folders can be read,
 * moved or deleted.
 *
 * Trash layout: `<trash>/<trashed-at ms>/<name>`. The time in the path is how
 * the purge knows when a file was trashed, so no index file can get out of
 * step with the folder. A trash item's id is `<trashed-at ms>/<name>`.
 */

export type MediaFile = {
  name: string
  size: number
  modified_at: Date
}

export type TrashItem = {
  id: string
  name: string
  size: number
  trashed_at: Date
}

export class MediaPathError extends Error {}

/** Absolute path of `name` inside `root`, or an error for anything that escapes it. */
export function resolveInside(root: string, name: string): string {
  if (
    typeof name !== "string" ||
    name === "" ||
    name.includes("\0") ||
    path.isAbsolute(name) ||
    name.split(/[\\/]/).some((part) => part === ".." || part === "")
  ) {
    throw new MediaPathError(`Invalid file name: ${name}`)
  }
  const resolvedRoot = path.resolve(root)
  const full = path.resolve(resolvedRoot, name)
  if (!full.startsWith(resolvedRoot + path.sep)) {
    throw new MediaPathError(`Invalid file name: ${name}`)
  }
  return full
}

function toName(root: string, full: string): string {
  return path.relative(root, full).split(path.sep).join("/")
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.lstat(p)
    return true
  } catch {
    return false
  }
}

/**
 * Every regular file under `root`, recursively. Hidden entries (a leading dot)
 * and symbolic links are skipped: they are not something the admin uploaded.
 */
export async function listFiles(root: string): Promise<MediaFile[]> {
  const out: MediaFile[] = []
  const resolvedRoot = path.resolve(root)

  async function walk(dir: string) {
    let entries: import("fs").Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (e: any) {
      if (e?.code === "ENOENT") return
      throw e
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        const stat = await fs.stat(full)
        out.push({
          name: toName(resolvedRoot, full),
          size: stat.size,
          modified_at: stat.mtime,
        })
      }
    }
  }

  await walk(resolvedRoot)
  return out
}

/**
 * Move a file, across disks too, keeping its mtime. It never replaces a file
 * at `to`: a hard link (or, across disks, a copy with COPYFILE_EXCL) fails
 * with EEXIST as one operation, so a file that appears at the destination
 * between a check and the move is not overwritten.
 */
async function moveFile(from: string, to: string) {
  await fs.mkdir(path.dirname(to), { recursive: true })
  try {
    await fs.link(from, to)
  } catch (e: any) {
    if (e?.code !== "EXDEV" && e?.code !== "EPERM" && e?.code !== "ENOTSUP") throw e
    const stat = await fs.stat(from)
    await fs.copyFile(from, to, fsConstants.COPYFILE_EXCL)
    await fs.utimes(to, stat.atime, stat.mtime)
  }
  await fs.unlink(from)
}

/** True when `full` (a file path) sits in a real folder under `root`, symlinks resolved. */
async function physicallyInside(root: string, full: string): Promise<boolean> {
  try {
    const realRoot = await fs.realpath(root)
    const realParent = await fs.realpath(path.dirname(full))
    return realParent === realRoot || realParent.startsWith(realRoot + path.sep)
  } catch {
    return false
  }
}

/** Remove empty folders from `dir` up to (not including) `root`. */
async function pruneEmptyDirs(dir: string, root: string) {
  const resolvedRoot = path.resolve(root)
  let current = path.resolve(dir)
  while (current.startsWith(resolvedRoot + path.sep)) {
    try {
      await fs.rmdir(current)
    } catch {
      return
    }
    current = path.dirname(current)
  }
}

export type TrashResult = {
  moved: TrashItem[]
  missing: string[]
  /** Files that could not be moved (permissions, disk); the others still were. */
  failed: { name: string; error: string }[]
}

export async function moveToTrash(
  uploadDir: string,
  trashDir: string,
  names: string[],
  now: Date = new Date()
): Promise<TrashResult> {
  const stamp = String(now.getTime())
  const moved: TrashItem[] = []
  const missing: string[] = []
  const failed: TrashResult["failed"] = []

  for (const name of names) {
    const from = resolveInside(uploadDir, name)
    const id = `${stamp}/${name}`
    const to = resolveInside(trashDir, id)
    let size: number
    try {
      const stat = await fs.stat(from)
      if (!stat.isFile()) {
        missing.push(name)
        continue
      }
      size = stat.size
    } catch {
      missing.push(name)
      continue
    }
    try {
      await moveFile(from, to)
    } catch (e: any) {
      failed.push({ name, error: e?.code || e?.message || String(e) })
      continue
    }
    await pruneEmptyDirs(path.dirname(from), uploadDir)
    moved.push({ id, name, size, trashed_at: now })
  }
  return { moved, missing, failed }
}

function parseTrashId(id: string): { stamp: number; name: string } | null {
  const slash = id.indexOf("/")
  if (slash <= 0) return null
  const stampText = id.slice(0, slash)
  if (!/^\d+$/.test(stampText)) return null
  const name = id.slice(slash + 1)
  if (!name) return null
  return { stamp: Number(stampText), name }
}

export async function listTrash(trashDir: string): Promise<TrashItem[]> {
  const items: TrashItem[] = []
  for (const file of await listFiles(trashDir)) {
    const parsed = parseTrashId(file.name)
    if (!parsed) continue
    items.push({
      id: file.name,
      name: parsed.name,
      size: file.size,
      trashed_at: new Date(parsed.stamp),
    })
  }
  return items.sort((a, b) => b.trashed_at.getTime() - a.trashed_at.getTime())
}

export type RestoreResult = {
  restored: string[]
  /** A file with that name is back in the upload folder; nothing was overwritten. */
  conflicts: string[]
  missing: string[]
}

export async function restoreFromTrash(
  uploadDir: string,
  trashDir: string,
  ids: string[]
): Promise<RestoreResult> {
  const result: RestoreResult = { restored: [], conflicts: [], missing: [] }
  for (const id of ids) {
    const parsed = parseTrashId(id)
    if (!parsed) throw new MediaPathError(`Invalid trash id: ${id}`)
    const from = resolveInside(trashDir, id)
    const to = resolveInside(uploadDir, parsed.name)
    if (!(await exists(from))) {
      result.missing.push(id)
      continue
    }
    if (await exists(to)) {
      result.conflicts.push(id)
      continue
    }
    try {
      await moveFile(from, to)
    } catch (e: any) {
      if (e?.code === "EEXIST") {
        result.conflicts.push(id)
        continue
      }
      throw e
    }
    // A fresh mtime gives the restored file a new grace period, so the next
    // cleanup does not move it straight back if the scan still misses it.
    const restoredAt = new Date()
    await fs.utimes(to, restoredAt, restoredAt)
    await pruneEmptyDirs(path.dirname(from), trashDir)
    result.restored.push(parsed.name)
  }
  return result
}

export async function deleteFromTrash(
  trashDir: string,
  ids: string[]
): Promise<{ deleted: string[]; missing: string[] }> {
  const deleted: string[] = []
  const missing: string[] = []
  for (const id of ids) {
    if (!parseTrashId(id)) throw new MediaPathError(`Invalid trash id: ${id}`)
    const full = resolveInside(trashDir, id)
    if (!(await exists(full))) {
      missing.push(id)
      continue
    }
    if (!(await physicallyInside(trashDir, full))) {
      throw new MediaPathError(`Invalid trash id: ${id}`)
    }
    try {
      await fs.unlink(full)
      deleted.push(id)
      await pruneEmptyDirs(path.dirname(full), trashDir)
    } catch (e: any) {
      if (e?.code === "ENOENT") missing.push(id)
      else throw e
    }
  }
  return { deleted, missing }
}

/** Deletes trash items older than `retentionDays`. Returns what was deleted. */
export async function purgeExpiredTrash(
  trashDir: string,
  retentionDays: number,
  now: Date = new Date()
): Promise<TrashItem[]> {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000
  const expired = (await listTrash(trashDir)).filter(
    (item) => item.trashed_at.getTime() <= cutoff
  )
  await deleteFromTrash(
    trashDir,
    expired.map((item) => item.id)
  )
  return expired
}

export type DiskSpace = { total_bytes: number; free_bytes: number } | null

/** Size and free space of the disk that holds `dir` (null where unsupported). */
export async function diskSpace(dir: string): Promise<DiskSpace> {
  try {
    const statfs = (fs as any).statfs as
      | ((p: string) => Promise<{ blocks: number; bsize: number; bavail: number }>)
      | undefined
    if (!statfs) return null
    let target = path.resolve(dir)
    while (!(await exists(target)) && path.dirname(target) !== target) {
      target = path.dirname(target)
    }
    const s = await statfs(target)
    return { total_bytes: s.blocks * s.bsize, free_bytes: s.bavail * s.bsize }
  } catch {
    return null
  }
}
