import { getMediaSettings } from "./config"
import { MediaReport, buildMediaReport } from "./library"
import { RawQueryRunner } from "./scan"

/**
 * The Media library pages through one scan instead of scanning the database
 * on every page or search. A change made through the admin clears it.
 */
const TTL_MS = 30 * 1000

let cached: { report: MediaReport; at: number } | null = null
/** Bumped by every clear, so a scan that started before a change is not cached. */
let generation = 0

export async function getMediaReport(
  db: RawQueryRunner,
  options: { refresh?: boolean } = {}
): Promise<MediaReport> {
  if (!options.refresh && cached && Date.now() - cached.at < TTL_MS) {
    return cached.report
  }
  const startedAt = generation
  const report = await buildMediaReport(db, getMediaSettings())
  if (startedAt === generation) cached = { report, at: Date.now() }
  return report
}

export function clearMediaReport() {
  generation++
  cached = null
}
