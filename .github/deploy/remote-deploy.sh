#!/usr/bin/env bash
# Runs ON THE SERVER, sent over SSH by .github/workflows/deploy-production.yml.
#
#   remote-deploy.sh inspect                 read-only: what is installed and running
#   remote-deploy.sh deploy both|backend|storefront
#   remote-deploy.sh media-backup            install the nightly media backup
#                                            (cron) and run it once now
#
# Order for "both": backend (pull, database backup, build, migrate, restart,
# health check), then storefront (pull, build, restart, check). Any failing step
# stops the run, so the storefront is never built against a backend that did
# not come up.
#
# Settings come from the environment (repository variables in GitHub):
#   BACKEND_DIR, STOREFRONT_DIR, BACKEND_PM2, STOREFRONT_PM2,
#   BACKEND_PORT (9000), STOREFRONT_PORT (8000), BACKUP_DIR (~/backups/deploy)
set -euo pipefail

MODE="${1:-inspect}"
TARGET="${2:-both}"

BACKEND_PM2="${BACKEND_PM2:-medusa-backend}"
BACKEND_PORT="${BACKEND_PORT:-9000}"
STOREFRONT_PORT="${STOREFRONT_PORT:-8000}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/deploy}"
BRANCH="${DEPLOY_BRANCH:-master}"

# A non-interactive SSH shell does not read .bashrc, so node/yarn/pm2 from nvm
# or a global npm prefix may be missing from PATH.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null
export PATH="$PATH:/usr/local/bin:$HOME/.yarn/bin:$HOME/.local/bin"

step() { echo; echo "::group::$*"; }
endstep() { echo "::endgroup::"; }
fail() { echo "::error::$*"; exit 1; }

wait_for_http() { # url seconds label
  local url="$1" secs="$2" label="$3" code
  for _ in $(seq 1 "$secs"); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" || true)
    if [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
      echo "$label answers $code at $url"; return 0
    fi
    sleep 1
  done
  fail "$label did not answer at $url within ${secs}s (last code: ${code:-none}). See: pm2 logs"
}

pull_master() { # dir
  cd "$1"
  # Next.js rewrites next-env.d.ts on every build (dev vs build route types),
  # so a tracked copy is always "changed" on the server. Put it back.
  if [ -f next-env.d.ts ] && ! git diff --quiet -- next-env.d.ts; then
    echo "restoring next-env.d.ts (rewritten by the last Next.js build)"
    git checkout -- next-env.d.ts
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short
    fail "$1 has uncommitted changes to tracked files. Nothing was changed; commit or stash them on the server first."
  fi
  git fetch origin "$BRANCH"
  echo "before: $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)"
  git checkout -q "$BRANCH"
  git merge --ff-only "origin/$BRANCH" || fail "$1 cannot fast-forward to origin/$BRANCH (local commits on the server?)."
  echo "after:  $(git rev-parse --short HEAD) $(git log -1 --format=%s)"
}

env_value() { # file key -> value without quotes
  grep -E "^[[:space:]]*(export[[:space:]]+)?$2=" "$1" | tail -1 | cut -d= -f2- \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

inspect() {
  step "Server"
  echo "user: $(whoami)  host: $(hostname)  date: $(date -Is)"
  df -h / | tail -1
  for c in node yarn pm2 pg_dump psql git; do
    printf '%-8s %s\n' "$c" "$(command -v "$c" >/dev/null && "$c" --version 2>/dev/null | head -1 || echo 'NOT FOUND')"
  done
  endstep
  step "pm2 processes (name, cwd, status)"
  if command -v pm2 >/dev/null; then
    pm2 jlist 2>/dev/null | node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        for (const p of JSON.parse(s||"[]")) console.log([p.name,p.pm2_env.pm_cwd,p.pm2_env.status].join("  |  "))
      })' || pm2 ls
  fi
  endstep
  for pair in "backend:${BACKEND_DIR:-}" "storefront:${STOREFRONT_DIR:-}"; do
    local name="${pair%%:*}" dir="${pair#*:}"
    step "$name directory: ${dir:-<not set>}"
    if [ -n "$dir" ] && [ -d "$dir/.git" ]; then
      git -C "$dir" log -1 --format='HEAD %h %s (%cr)'
      git -C "$dir" rev-parse --abbrev-ref HEAD
      git -C "$dir" fetch -q origin "$BRANCH" && echo "behind origin/$BRANCH by $(git -C "$dir" rev-list --count HEAD..origin/"$BRANCH") commit(s)" || echo "git fetch FAILED (does the server have read access to the repository?)"
      git -C "$dir" status --short | head -20
    else
      echo "not a git checkout"
    fi
    endstep
  done
  if [ -n "${BACKEND_DIR:-}" ] && [ -f "$BACKEND_DIR/.env" ]; then
    step "Backend database"
    [ -n "$(env_value "$BACKEND_DIR/.env" DATABASE_URL)" ] && echo "DATABASE_URL is set in .env" || echo "DATABASE_URL NOT found in .env"
    endstep
    inspect_media
  fi
}

# Read-only: where the uploads are, how big, and whether the backup runs.
inspect_media() {
  local env="$BACKEND_DIR/.env" dir trash
  step "Media"
  dir="$(env_value "$env" UPLOAD_DIR || true)"
  if [ -z "$dir" ]; then
    echo "UPLOAD_DIR NOT set in .env"
  elif [ -d "$dir" ]; then
    echo "UPLOAD_DIR: $dir"
    echo "files: $(find "$dir" -type f ! -name '.*' | wc -l), size: $(du -sh "$dir" | cut -f1)"
    echo "uploads (named <ms>-name): $(find "$dir" -type f -regextype posix-extended -regex '.*/[0-9]{13}-[^/]+' | wc -l)"
    trash="$(env_value "$env" MEDIA_TRASH_DIR || true)"; trash="${trash:-${dir%/}-trash}"
    [ -d "$trash" ] && echo "trash: $trash ($(find "$trash" -type f | wc -l) files, $(du -sh "$trash" | cut -f1))" || echo "trash: $trash (none yet)"
    df -h "$dir" | tail -1
  else
    echo "UPLOAD_DIR $dir does not exist"
  fi
  echo "MEDIA_CLEANUP_MODE: $(env_value "$env" MEDIA_CLEANUP_MODE || true) (empty means report)"
  echo "rclone: $(command -v rclone >/dev/null && rclone version 2>/dev/null | head -1 || echo 'not installed')"
  [ -n "$(env_value "$env" MEDIA_BACKUP_R2_BUCKET)" ] && echo "backup bucket: set" || echo "backup bucket: NOT set"
  crontab -l 2>/dev/null | grep -q "infinytree-media-backup" && echo "backup cron: installed" || echo "backup cron: not installed"
  if [ -f "$MEDIA_BACKUP_LOG" ]; then echo "last backup log lines:"; tail -5 "$MEDIA_BACKUP_LOG"; fi
  endstep
}

MEDIA_BACKUP_LOG="${MEDIA_BACKUP_LOG:-$HOME/backups/media-backup.log}"

# Installs the nightly media backup in this user's crontab (03:15, before the
# backend's 03:40 media cleanup) and runs it once, so a wrong key shows now.
media_backup_setup() {
  [ -n "${BACKEND_DIR:-}" ] || fail "BACKEND_DIR is not set (repository variable)."
  local script="$BACKEND_DIR/.github/deploy/media-backup.sh" env="$BACKEND_DIR/.env"
  [ -f "$script" ] || fail "$script not found: deploy the backend first."
  for key in MEDIA_BACKUP_R2_ACCOUNT_ID MEDIA_BACKUP_R2_ACCESS_KEY_ID MEDIA_BACKUP_R2_SECRET_ACCESS_KEY MEDIA_BACKUP_R2_BUCKET; do
    [ -n "$(env_value "$env" "$key")" ] || fail "$key is not set in $env. Add the R2 keys first (README, Media backup)."
  done

  step "rclone"
  if ! command -v rclone >/dev/null; then
    if [ "$(id -u)" = 0 ]; then apt-get update -qq && apt-get install -y -qq rclone; else sudo -n apt-get install -y -qq rclone; fi
  fi
  rclone version | head -1
  endstep

  step "cron"
  mkdir -p "$(dirname "$MEDIA_BACKUP_LOG")"
  local line="15 3 * * * BACKEND_DIR=$BACKEND_DIR /bin/bash $script >> $MEDIA_BACKUP_LOG 2>&1 # infinytree-media-backup"
  { crontab -l 2>/dev/null | grep -v "infinytree-media-backup" || true; echo "$line"; } | crontab -
  crontab -l | grep "infinytree-media-backup"
  endstep

  step "First backup"
  BACKEND_DIR="$BACKEND_DIR" bash "$script" 2>&1 | tee -a "$MEDIA_BACKUP_LOG"
  [ "${PIPESTATUS[0]}" = 0 ] || fail "the backup failed; see the lines above"
  endstep
}

deploy_backend() {
  [ -n "${BACKEND_DIR:-}" ] || fail "BACKEND_DIR is not set (repository variable)."
  step "Backend: pull $BRANCH"; pull_master "$BACKEND_DIR"; endstep

  step "Backend: database backup"
  local db_url file
  db_url="$(env_value "$BACKEND_DIR/.env" DATABASE_URL)"
  [ -n "$db_url" ] || fail "DATABASE_URL not found in $BACKEND_DIR/.env; refusing to migrate without a backup."
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  file="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).dump"
  pg_dump --format=custom --no-owner --file="$file" "$db_url" || fail "pg_dump failed; nothing was built or migrated."
  [ -s "$file" ] || fail "backup file is empty"
  echo "backup: $file ($(du -h "$file" | cut -f1))"
  echo "restore with: pg_restore --clean --if-exists --no-owner -d \"\$DATABASE_URL\" $file"
  # keep the 10 newest deploy backups
  ls -1t "$BACKUP_DIR"/pre-deploy-*.dump 2>/dev/null | tail -n +11 | xargs -r rm -f
  endstep

  step "Backend: install and build"
  cd "$BACKEND_DIR"
  yarn install
  yarn build
  endstep

  step "Backend: migrate"
  cd "$BACKEND_DIR/.medusa/server"
  npx medusa db:migrate
  endstep

  step "Backend: restart $BACKEND_PM2"
  pm2 restart "$BACKEND_PM2" --update-env
  wait_for_http "http://localhost:$BACKEND_PORT/health" 180 "backend"
  endstep
}

deploy_storefront() {
  [ -n "${STOREFRONT_DIR:-}" ] || fail "STOREFRONT_DIR is not set (repository variable)."
  [ -n "${STOREFRONT_PM2:-}" ] || fail "STOREFRONT_PM2 is not set (repository variable)."
  step "Storefront: pull $BRANCH"; pull_master "$STOREFRONT_DIR"; endstep

  step "Storefront: install and build"
  cd "$STOREFRONT_DIR"
  yarn install
  yarn build
  endstep

  step "Storefront: restart $STOREFRONT_PM2"
  pm2 restart "$STOREFRONT_PM2" --update-env
  wait_for_http "http://localhost:$STOREFRONT_PORT/" 120 "storefront"
  endstep
}

case "$MODE" in
  inspect) inspect ;;
  deploy)
    case "$TARGET" in
      both) deploy_backend; deploy_storefront ;;
      backend) deploy_backend ;;
      storefront) deploy_storefront ;;
      *) fail "unknown target: $TARGET" ;;
    esac
    pm2 save >/dev/null 2>&1 || true
    echo; echo "Deploy finished: $TARGET"
    ;;
  media-backup) media_backup_setup ;;
  *) fail "unknown mode: $MODE" ;;
esac
