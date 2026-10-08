# CLAUDE.md — Infinytree Backend (Medusa v2)

**Medusa version**: 2.18.0 | **Zod**: v4.2.0 | **MikroORM**: 6.6.14 | **Package manager**: Yarn 3.6.4

---

## Knowledge Graph (RAG)

The `graphify-out/` directory contains a pre-built knowledge graph of this backend (170 nodes, 175 edges, 41 communities). **Consult it before touching god nodes or changing the API surface.**

### When to consult

- **Before touching god nodes**: `MinioFileProviderService` (10 edges), `GET()` store pages route (7 edges), `Pages Admin Route` (7 edges), `Admin SDK Session Client` (6 edges), `Page Form` (6 edges), `Create Page Step` / `Update Page Step` (6 edges each)
- **Before adding/modifying workflows** — check the "Page Workflow Lifecycle" hyperedge (create → update → delete steps with compensation handlers)
- **Before changing the Page module** — it has dual API surfaces (admin CRUD at `/admin/pages` + storefront delivery at `/store/pages/[slug]`). The storefront depends on `GET /store/pages/[slug]`
- **When debugging MinIO/storage** — `MinioFileProviderService` is the top god node, touching bucket bootstrap, presigned URLs, public access, and local fallback

### How to consult

1. Read `graphify-out/GRAPH_REPORT.md` for community hubs, god nodes, hyperedges, and surprising connections
2. Search `graphify-out/graph.json` for specific node/community names

---

## Project Architecture

This is an **Infinytree Medusa v2 backend** with custom modules, translation support, and admin extensions.

### Directory Map

| Directory | Purpose |
|-----------|---------|
| `src/api/admin/pages/` | Admin Page CRUD (`/admin/pages`, `/admin/pages/[id]`) |
| `src/api/admin/products/[id]/translate/` | Admin product translation endpoint |
| `src/api/admin/custom/` | Custom admin API routes |
| `src/api/store/pages/` | Storefront Page delivery (`/store/pages`, `/store/pages/[slug]`) |
| `src/api/store/contact/` | Contact form endpoint (Resend/SendGrid email) |
| `src/api/store/site/` | Site configuration endpoint |
| `src/api/store/custom/` | Custom store API routes |
| `src/api/middlewares.ts` | API middleware registry (validation, error handling) |
| `src/modules/page/` | Custom Page module — entity, service, migration |
| `src/modules/minio-file/` | MinIO file storage provider (S3-compatible) |
| `src/workflows/` | Medusa workflows (page CRUD, product translation) |
| `src/workflows/steps/` | Workflow steps (create/update/delete page, translate-text, save-translations) |
| `src/admin/routes/pages/` | Admin UI — Pages screen with rich text editor |
| `src/admin/components/` | Reusable admin components (image upload, rich text editor) |
| `src/admin/widgets/` | Admin widgets (product translation widget) |
| `src/admin/lib/` | Admin SDK client (shared client configuration) |
| `src/admin/i18n/` | Admin i18n translations (react-i18next) |
| `src/scripts/` | Seed scripts, postbuild deployment, translation service health check |
| `src/jobs/` | Scheduled jobs |
| `www/` | Frontend static assets (app metadata) |
| `static/` | Uploaded media files (local storage fallback) |
| `integration-tests/` | HTTP and module integration test suite |
| `packages/` | Reserved for local packages (currently empty) |

### Core Architectural Patterns

- **Custom Module (Page)** — Entity → Service → Workflows → Dual API Routes (admin + store). The storefront reads pages via `GET /store/pages/[slug]`; admin manages them via full CRUD
- **Workflow Steps** — Each page operation (create/update/delete) is a Medusa workflow with compensation handlers. Translation workflows follow the same pattern (translate-text → save-translations)
- **MinIO Storage** — `MinioFileProviderService` handles bucket bootstrap on init, presigned upload URLs, public-read access, and local filesystem fallback. Works with any S3-compatible storage (Cloudflare R2, AWS S3, MinIO)
- **API Middleware** — Layered: global (`src/api/middlewares.ts`), admin-specific (`src/api/admin/pages/middlewares.ts`), store-specific (`src/api/store/pages/middlewares.ts`, `src/api/store/contact/middlewares.ts`). All use Zod v4 schemas with `validateAndTransformQuery` / `validateAndTransformBody`
- **Admin Extensions** — Custom admin route for Pages, rich text editor (TipTap), image upload (MinIO presigned), product translation widget, i18n translations
- **Translation System** — Uses `google-translate-api-x` with `featureFlags.translation: true` in medusa-config. Product translation workflow + admin widget for on-demand translation
- **Contact Form** — Posts to Resend (or SendGrid fallback) via `POST /store/contact` with Zod-validated body
- **Admin Invites** — Medusa emits `invite.created` / `invite.resent` but sends no email itself, so `src/subscribers/admin-user-invite.ts` emails the invitee a link to the admin's accept page (`BACKEND_PUBLIC_URL` + admin path + `/invite?token=`; without `BACKEND_PUBLIC_URL` in production the link points at localhost). It goes out as finished HTML, so the token (which can create an admin account) stays out of the notification log. Invites work for 24 hours by default (user module option `valid_duration`); an expired or lost one is renewed with "Resend invite" under Settings → Users. Test: `integration-tests/http/admin-invites.spec.ts` (needs `DB_USERNAME` when the local Postgres has no `postgres` role)

### God Nodes (Top 15 by edge count)

| # | Node | File | Edges | What depends on it |
|---|------|------|-------|--------------------|
| 1 | `MinioFileProviderService` | `src/modules/minio-file/service.ts` | 10 | medusa-config, file upload UI, seed scripts, presigned URLs |
| 2 | `GET()` (store page by slug) | `src/api/store/pages/[slug]/route.ts` | 7 | Storefront page rendering |
| 3 | `Pages Admin Route` | `src/admin/routes/pages/page.tsx` | 7 | Admin UI, page form, SDK client |
| 4 | `Admin SDK Session Client` | `src/admin/lib/client.ts` | 6 | All admin UI components and widgets |
| 5 | `Page Form` | `src/admin/routes/pages/page.tsx` | 6 | Admin page create/edit UI |
| 6 | `Create Page Step` | `src/workflows/steps/create-page.ts` | 6 | Page creation workflow |
| 7 | `Update Page Step` | `src/workflows/steps/update-page.ts` | 6 | Page update workflow |
| 8 | `Admin Page Detail API` | `src/api/admin/pages/[id]/route.ts` | 5 | Admin page detail view |
| 9 | `Update Page Workflow` | `src/workflows/update-page.ts` | 5 | Page update flow |
| 10 | `Page Module Service` | `src/modules/page/service.ts` | 5 | Workflows, API routes, admin UI |
| 11 | `MinIO File Provider Module` | `src/modules/minio-file/index.ts` | 5 | medusa-config module registration |
| 12 | `Backend Configuration` | `medusa-config.ts` | 4 | All modules, providers, plugins |
| 13 | `Public Asset Storage` | `src/modules/minio-file/service.ts` | 4 | Admin file upload, static serving |
| 14 | `Page Entity` | `src/modules/page/models/page.ts` | 4 | Service, migration, API validation |
| 15 | `Admin Pages API` | `src/api/admin/pages/route.ts` | 4 | Admin page list/create |

### Key Communities (graph clustering)

| Community | Nodes | Contains |
|-----------|-------|----------|
| Page Admin Workflows | 25 | Admin SDK client, page CRUD steps, page module service, workflows with compensation handlers |
| Admin Extension Docs | 16 | Integration tests, admin customizations, widgets, translations |
| Core Backend Config | 15 | Medusa config, module registration, MinIO file provider, local file fallback, store site API |
| Page API Data Model | 14 | Page module, service operations, page entity, table schema, admin pages API |
| MinIO Service Methods | 11 | MinioFileProviderService, `.constructor()`, `.validateOptions()`, `.initializeBucket()` |
| Route Handlers | 10 | All GET()/POST() route handlers across admin and store APIs |

### Surprising Connections (from graph analysis)

- `Update Page Workflow` ⟷ `Delete Page Workflow` — semantically similar (INFERRED 1.0)
- `Admin Pages API` ⟷ `Store Pages API` — semantically similar (INFERRED 1.0)
- `Admin Page Detail API` ⟷ `Store Page By Slug API` — semantically similar (INFERRED 1.0)
- `Server Dependency Install` → `Page Module Service` — postbuild touches page creation step (AMBIGUOUS)

### Hyperedges (group relationships)

| Group | Members | Confidence |
|-------|---------|------------|
| Page CRUD Surface | admin pages API + detail API + page service + page entity | EXTRACTED 1.00 |
| Storefront Page Delivery | store pages API + store page by slug + page entity + query validation middleware | INFERRED 0.90 |
| Storage Bootstrap Flow | medusa-config + bucket bootstrap + public asset storage + presigned access | EXTRACTED 1.00 |
| Admin Page Authoring Surface | pages admin route + page form + image upload + rich text editor | EXTRACTED 1.00 |
| Page Workflow Lifecycle | create-page + update-page + delete-page workflows | INFERRED 0.84 |
| Page Module Service Operations | create/update/delete steps + page module service | EXTRACTED 1.00 |
| Admin Extension Surface | admin customizations + widgets + i18n translations | EXTRACTED 1.00 |
| Backend Execution Entrypoints | API routes + workflows + CLI scripts + subscribers + jobs | INFERRED 0.79 |
| MinIO Storage Behavior | MinIO provider + public read access + local storage fallback + presigned URLs | EXTRACTED 1.00 |

---

## Cross-System Dependencies

The storefront (`../nfiniytree-storefront/`) depends on this backend for:
- **CMS Pages** — `retrievePageBySlug()` hits `GET /store/pages/[slug]`
- **Contact Form** — posts to `POST /store/contact`
- **All commerce** — cart, checkout, products, auth via Medusa core APIs

---

## Sales Commission Plugin (`medusa-plugin-sales-commission`)

Salespeople are assigned to customers at a per-client rate and earn commission on every paid order (plus Level 2 for the rep who referred them). Each rep has one running balance per currency; the owner approves finished months, pays in one payment run, and reps recruit new reps by invite. It is a **separate Medusa plugin** in the sibling repo `../medusa-plugin-sales-commission` (see its README for rules, API, events and the Make.com hand-off), vendored here as a tarball (yalc for local development) and registered under `plugins` in `medusa-config.ts` (options: `timezone`, `portal_url`, `fx_auto_fetch`, `payout_day`, `invite_days`, `level2_default_rate`, `level2_default_months`; each has a `SALES_COMMISSION_*` variable in `.env.template`).

- **Trigger** — `payment.captured`. Make.com captures the Medusa payment when Billingo reports the bank transfer (`POST /admin/payments/{id}/capture`), or an admin clicks Capture. No change to `src/subscribers/order-events-make.ts` is needed
- **Voids and refunds** — `order.canceled` and a full `payment.refunded` void the commission; a partial refund takes back the refunded share with adjustments in the current month (under a per-order lock). A nightly job re-runs all of it for the last 7 days
- **Currency** — a rep can be paid in EUR or HUF; commission in the other currency is converted when earned at the ECB rate of the day, stored on the entry. A weekday job fetches the ECB rate (`SALES_COMMISSION_FX_FETCH=false` turns it off; rates can be entered under Payment run)
- **Admin** — Sales Reps (balance per rep, "Hide inactive"), Applications, Payment run and Commission report screens, plus a "Sales rep" widget on the customer page. A rep is **deleted** only when they have no money on record, no current clients or recruits and nothing waiting (`DELETE /admin/sales-reps/:id`, the "Delete rep" box on the rep page); any other rep is deactivated. A deleted rep's portal login stays in Medusa, linked to nobody, and the next rep with that email takes it over (plugin step `link-portal-auth-identity`: Medusa's own link step refuses a login that ever had a rep)
- **Recruiting** — reps invite from the portal; the candidate applies from a personal link (`/sales-portal/join/<token>`, public routes `/sales-invites/*` in the plugin); the owner approves or declines under Sales Reps → Applications. The plugin emits `sales-commission.invite.sent`, `.application.received`, `.approved` and `.declined`; `src/subscribers/sales-rep-invite.ts` and `sales-application-*.ts` turn them into the emails in `src/modules/resend/emails/Rep*.tsx` (en, de-AT, de-DE, hu-HU). These are rendered in `src/utils/rep-emails.ts` and sent as finished HTML, so the secret link tokens never reach the notification log. The owner's "new application" email goes to `SALES_COMMISSION_NOTIFY_EMAIL`, else `CONTACT_EMAIL`
- **Sales portal** — reps sign in with Medusa's own auth as the `sales_rep` actor (`/auth/sales_rep/emailpass`) and read their own numbers from the plugin's read-only `/sales-portal/*` API, called server-side by the storefront at `/<country>/sales-portal` (see the storefront's CLAUDE.md). An admin gives or ends access under Sales Reps → rep → Sales portal; the rep sets a first password with forgot-password. `PasswordResetEmail` links reps to `/sales-portal/reset-password` (`src/utils/password-reset-link.ts`). `portal_url` comes from `SALES_PORTAL_URL`, else `STOREFRONT_PUBLIC_URL` + `/sales-portal`
- **Tests** — `integration-tests/http/sales-commission-*.spec.ts`. `jest.config.js` transforms `.tsx` (Resend email templates) and maps the ESM-only `@react-pdf/renderer` to `integration-tests/mocks/react-pdf.js`, which is what lets HTTP tests boot the app. Medusa loads `.env` even when tests run, so `integration-tests/setup.js` blanks `MAKE_ORDER_WEBHOOK_URL`, `RESEND_API_KEY` and the SendGrid keys first: without that a test that cancels an order posts to the live Make.com scenario. `order-events-make.ts` skips when no webhook URL is set
- **Develop** — run `npx medusa plugin:develop` in the plugin (yalc pushes each rebuild here; one-time `npx medusa plugin:add medusa-plugin-sales-commission`). yalc swaps the dependency for `file:.yalc/...`, so run `npx yalc retreat medusa-plugin-sales-commission` before committing. After a plugin rebuild the admin can show the old UI (Vite's dependency cache, plus the browser's immutable copy of it): stop the dev server, delete `node_modules/.vite`, start it, then hard-reload the admin tab (Cmd/Ctrl+Shift+R)
- **Install / deploy** — the plugin is vendored: `package.json` points at `file:./vendor/medusa-plugin-sales-commission-<version>.tgz` (about 200 kB, committed), so the usual pull → `yarn install` → `yarn build` works with no registry or token. `src/scripts/postBuild.js` copies `vendor/` into `.medusa/server` so the install there resolves it too. `.yalc/` and `yalc.lock` stay git-ignored
- **Migrations** — neither `yarn build` nor `medusa start` runs them. After a deploy that adds a migration (the plugin's 7 tables on first deploy; the ledger, exchange rate and recruiting release adds three more tables and columns), run `cd .medusa/server && npx medusa db:migrate` before restarting
- **Release a new plugin version** — in the plugin repo: `npm version patch`, then `git push origin master --follow-tags`. The plugin's *Release to backend* workflow tests and builds it, vendors the tarball here and opens a pull request (only `package.json`, `yarn.lock` and `vendor/` change, and the description says whether to migrate). Merge it and deploy as above. The workflow needs the `BACKEND_REPO_TOKEN` secret in the plugin repo (setup in its README). Manual fallback: `npm version patch --no-git-tag-version`, then `npm run release:backend` in the plugin, and commit those files here

---

## Upgrade Notes (2.13.6 → 2.17.2)

This backend was upgraded from Medusa 2.13.6 to 2.17.2 on 2026-07-02 and has since moved to 2.18.0 (`package.json` `^2.18.0`, installed 2.18.0; the plugin pins `@medusajs/*` to exactly 2.18.0). Key breaking changes handled in the 2.17.2 upgrade:

| Change | File(s) affected | Resolution |
|--------|-----------------|------------|
| Zod v4 — `z.string().email()` removed | `src/api/store/contact/route.ts` | Changed to `z.email({ error: "..." })` |
| Zod v4 — `z.record(val)` → `z.record(key, val)` | `src/api/admin/pages/middlewares.ts` | Changed to `z.record(z.string(), z.unknown())` |
| JWT/cookie secret must not hardcode `"supersecret"` in production | `medusa-config.ts` | Changed fallback to `"supersecret-dev"` (dev only) |
| @mikro-orm/* bumped 6.6.12 → 6.6.14 | `package.json` | CVE-2026-44680 fix |

### How to update Medusa (correct workflow)

This is a **Medusa project** (consumes `@medusajs/*` via npm), NOT a fork of the `medusajs/medusa` monorepo. Do NOT add the monorepo as a git remote — updates come through npm:

```bash
# 1. Check available updates
yarn outdated | grep '@medusajs'

# 2. Bump versions in package.json
yarn add @medusajs/medusa@^<version> @medusajs/framework@^<version> ...

# 3. Run migrations
yarn medusa db:migrate

# 4. Build and verify
yarn medusa build
```

For structural changes to `medusa-config.ts` or project conventions, scaffold a fresh project at the target version and diff the config files:

```bash
npx create-medusa-app@<version> --no-install --no-browser /tmp/medusa-fresh
diff medusa-config.ts /tmp/medusa-fresh/medusa-config.ts
```

---

## Memory

A knowledge corpus `infinytree-architecture` is maintained in claude-mem covering this backend's architecture. Rebuild after significant changes.
