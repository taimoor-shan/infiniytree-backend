# CLAUDE.md — Infinytree Backend (Medusa v2)

**Medusa version**: 2.17.2 | **Zod**: v4.2.0 | **MikroORM**: 6.6.14 | **Package manager**: Yarn 3.6.4

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

## Upgrade Notes (2.13.6 → 2.17.2)

This backend was upgraded from Medusa 2.13.6 to 2.17.2 on 2026-07-02. Key breaking changes handled:

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
