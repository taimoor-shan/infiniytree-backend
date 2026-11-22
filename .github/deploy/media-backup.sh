#!/usr/bin/env bash
# Nightly off-site backup of the uploaded media (and a database dump) to a
# private Cloudflare R2 bucket, on its free tier (10 GB). Runs ON THE SERVER
# from cron; installed and first run by the "Deploy production" workflow in
# mode media-backup (see .github/deploy/README.md, "Media backup").
#
#   media-backup.sh            back up now
#
# Settings are read from the backend's .env ($BACKEND_DIR/.env):
#   UPLOAD_DIR                          the folder Medusa stores uploads in
#   DATABASE_URL                        for the database dump
#   MEDIA_BACKUP_R2_ACCOUNT_ID          Cloudflare account id
#   MEDIA_BACKUP_R2_ACCESS_KEY_ID       R2 API token (Object Read & Write, this bucket only)
#   MEDIA_BACKUP_R2_SECRET_ACCESS_KEY
#   MEDIA_BACKUP_R2_BUCKET              e.g. infinytree-backup
#   MEDIA_BACKUP_KEEP_DELETED_DAYS      (30) how long a deleted or replaced file stays in the bucket
#   MEDIA_BACKUP_DATABASE               (true) also upload a pg_dump
#   MEDIA_BACKUP_KEEP_DATABASE_DAYS     (14)
#
# Bucket layout:
#   uploads/                  mirror of UPLOAD_DIR
#   deleted/<YYYY-MM-DD>/<HHMMSS>/  files that left UPLOAD_DIR (or were changed) in that run
#   database/<stamp>.dump     pg_dump --format=custom
#
# Restore a file:   rclone copy r2:<bucket>/uploads/<file> "$UPLOAD_DIR"/
# Restore all:      rclone copy r2:<bucket>/uploads "$UPLOAD_DIR"
# (with the same RCLONE_CONFIG_R2_* variables this script sets)
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
ENV_FILE="$BACKEND_DIR/.env"

log() { echo "[media-backup $(date -Is)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found (set BACKEND_DIR)"

env_value() { # key -> value without quotes, from .env
  { grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$ENV_FILE" || true; } | tail -1 | cut -d= -f2- \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

UPLOAD_DIR="$(env_value UPLOAD_DIR)"
ACCOUNT_ID="$(env_value MEDIA_BACKUP_R2_ACCOUNT_ID)"
ACCESS_KEY="$(env_value MEDIA_BACKUP_R2_ACCESS_KEY_ID)"
SECRET_KEY="$(env_value MEDIA_BACKUP_R2_SECRET_ACCESS_KEY)"
BUCKET="$(env_value MEDIA_BACKUP_R2_BUCKET)"
KEEP_DELETED_DAYS="$(env_value MEDIA_BACKUP_KEEP_DELETED_DAYS)"; KEEP_DELETED_DAYS="${KEEP_DELETED_DAYS:-30}"
BACKUP_DATABASE="$(env_value MEDIA_BACKUP_DATABASE)"; BACKUP_DATABASE="${BACKUP_DATABASE:-true}"
KEEP_DB_DAYS="$(env_value MEDIA_BACKUP_KEEP_DATABASE_DAYS)"; KEEP_DB_DAYS="${KEEP_DB_DAYS:-14}"

[ -n "$UPLOAD_DIR" ] || fail "UPLOAD_DIR is not set in $ENV_FILE"
[ -d "$UPLOAD_DIR" ] || fail "UPLOAD_DIR $UPLOAD_DIR does not exist"
for v in ACCOUNT_ID ACCESS_KEY SECRET_KEY BUCKET; do
  [ -n "${!v}" ] || fail "MEDIA_BACKUP_R2_* settings are missing in $ENV_FILE (see .github/deploy/README.md)"
done
command -v rclone >/dev/null || fail "rclone is not installed (apt-get install -y rclone)"

# One run at a time: a slow upload must not overlap the next night's run.
exec 9>"/tmp/infinytree-media-backup.lock"
flock -n 9 || fail "another backup is still running"

# rclone reads the remote "r2" from these variables, so no config file holds the keys.
# No config file: the remote comes only from these variables.
export RCLONE_CONFIG=/dev/null
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$ACCESS_KEY"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$SECRET_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_REGION=auto
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_ACL=private

REMOTE="r2:$BUCKET"
TODAY="$(date +%F)"
# One folder per run under the day, so a second run the same day (the setup
# run, a manual one) never overwrites what the first one archived.
RUN_ID="$(date +%H%M%S)-$$-$(od -An -N4 -tx4 /dev/urandom | tr -d " ")"

log "uploads: $UPLOAD_DIR ($(du -sh "$UPLOAD_DIR" | cut -f1)) -> $REMOTE/uploads"
# A file that is deleted or replaced locally is moved to deleted/<today>/
# instead of being removed from the bucket. Hidden files are not uploads.
rclone sync "$UPLOAD_DIR" "$REMOTE/uploads" \
  --backup-dir "$REMOTE/deleted/$TODAY/$RUN_ID" \
  --exclude ".*" --exclude ".*/**" \
  --fast-list --transfers 4 --stats-one-line --stats 0 -v 2>&1 | tail -5

# deleted/<date>/ folders older than KEEP_DELETED_DAYS go (by the date in the
# name: a file's own time is its upload time, which may be years old).
cutoff="$(date -d "-${KEEP_DELETED_DAYS} days" +%F)"
for dir in $(rclone lsf --dirs-only "$REMOTE/deleted" 2>/dev/null || true); do
  day="${dir%/}"
  if [[ "$day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && [[ "$day" < "$cutoff" ]]; then
    log "removing deleted/$day (older than $KEEP_DELETED_DAYS days)"
    rclone purge "$REMOTE/deleted/$day"
  fi
done

if [ "$BACKUP_DATABASE" = "true" ]; then
  DB_URL="$(env_value DATABASE_URL)"
  [ -n "$DB_URL" ] || fail "DATABASE_URL is not set in $ENV_FILE"
  dump="$(mktemp --suffix=.dump)"
  trap 'rm -f "$dump"' EXIT
  pg_dump --format=custom --no-owner --file="$dump" "$DB_URL"
  [ -s "$dump" ] || fail "pg_dump wrote an empty file"
  name="database/$(date +%Y%m%d-%H%M%S).dump"
  rclone copyto "$dump" "$REMOTE/$name"
  log "database: $name ($(du -h "$dump" | cut -f1))"
  rclone delete "$REMOTE/database" --min-age "${KEEP_DB_DAYS}d"
fi

log "done"
