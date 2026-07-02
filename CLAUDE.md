# CLAUDE.md — Medusa Backend

## Knowledge Graph (RAG)

The `graphify-out/` directory contains a pre-built knowledge graph of this backend (170 nodes, 175 edges, 41 communities). **Consult it before touching god nodes or changing the API surface.**

### When to consult

- **Before touching god nodes**: `MinioFileProviderService` (10 edges), Page API route handlers `GET()`/`POST()` (7 edges each), Admin SDK Session Client (6 edges), Page Form (6 edges), Create/Update Page Steps (6 edges each)
- **Before adding/modifying workflows** — check "Hyperedges" for the Page Workflow Lifecycle pattern (create → update → delete steps)
- **Before changing the Page module** — it has dual API surfaces (admin CRUD + storefront delivery). The storefront depends on `GET /store/pages/[slug]`
- **When debugging MinIO/storage** — `MinioFileProviderService` is the top god node, touching bootstrap, presigned URLs, public access, and local fallback

### How to consult

1. Read `graphify-out/GRAPH_REPORT.md` for community hubs, god nodes, hyperedges
2. Search `graphify-out/graph.json` for specific node/community names

---

## Project Architecture

This is a **Medusa backend** with custom modules and admin extensions.

### Directory Map

| Directory | Purpose |
|-----------|---------|
| `src/api/` | Custom API routes (admin + store) |
| `src/api/admin/pages/` | Admin Page CRUD (`/admin/pages`, `/admin/pages/[id]`) |
| `src/api/store/pages/` | Storefront Page delivery (`/store/pages`, `/store/pages/[slug]`) |
| `src/api/store/contact/` | Contact form endpoint |
| `src/api/middlewares.ts` | API middleware registry (validation, error handling) |
| `src/modules/page/` | Custom Page module — entity, service, migrations |
| `src/modules/minio/` | MinIO file storage provider |
| `src/workflows/` | Medusa workflows (create/update/delete page) |
| `src/admin/` | Admin UI extensions (pages screen, rich text editor, i18n) |
| `src/scripts/` | Seed scripts, postbuild deployment, translation service |
| `src/subscribers/` | Event subscribers |
| `src/jobs/` | Scheduled jobs |

### Core Architectural Patterns

- **Custom Module (Page)**: Entity → Service → Workflows → Dual API Routes (admin + store). The storefront reads pages via `GET /store/pages/[slug]`; admin manages them via full CRUD
- **Workflow Steps**: Each page operation (create/update/delete) is a Medusa workflow with compensation handlers. Steps are in `src/workflows/steps/`
- **MinIO Storage**: `MinioFileProviderService` — bucket bootstrap, presigned URLs, public-read access, local fallback. Used by admin for image uploads
- **API Middleware**: Layered — global (`src/api/middlewares.ts`), admin-specific, store-specific. Store page endpoints have query validation middleware
- **Admin Extensions**: Custom admin route for Pages, rich text editor component, image upload component, i18n translations

### Key Files (God Nodes)

| Node | File | Edges | What depends on it |
|------|------|-------|-------------------|
| `MinioFileProviderService` | `src/modules/minio/service.ts` | 10 | medusa-config, file upload UI, seed scripts |
| `GET()` / `POST()` | `src/api/` route files | 7 | Admin UI, storefront, middleware |
| Admin SDK Session Client | `src/admin/client.ts` | 6 | All admin UI components |
| Page Module Service | `src/modules/page/service.ts` | — | Workflows, API routes, admin UI |
| Page Entity | `src/modules/page/models/page.ts` | — | Service, migration, API validation |

### Cross-System Dependencies

The storefront (`../storefront/`) depends on this backend for:
- **CMS Pages** — `retrievePageBySlug()` hits `GET /store/pages/[slug]`
- **Contact Form** — posts to `POST /store/contact`
- **All commerce** — cart, checkout, products, auth via Medusa core APIs

## Memory

A knowledge corpus `infinytree-architecture` is maintained in claude-mem covering this backend's architecture. Rebuild after significant changes.
