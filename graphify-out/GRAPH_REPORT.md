# Graph Report - backend  (2026-04-22)

## Corpus Check
- 52 files · ~70,368 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 170 nodes · 175 edges · 41 communities detected
- Extraction: 75% EXTRACTED · 24% INFERRED · 1% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Page Admin Workflows|Page Admin Workflows]]
- [[_COMMUNITY_Admin Extension Docs|Admin Extension Docs]]
- [[_COMMUNITY_Core Backend Config|Core Backend Config]]
- [[_COMMUNITY_Page API Data Model|Page API Data Model]]
- [[_COMMUNITY_MinIO Service Methods|MinIO Service Methods]]
- [[_COMMUNITY_Module Storage Docs|Module Storage Docs]]
- [[_COMMUNITY_Route Handlers|Route Handlers]]
- [[_COMMUNITY_Biophilic Atrium Image|Biophilic Atrium Image]]
- [[_COMMUNITY_Bedroom Staging Image|Bedroom Staging Image]]
- [[_COMMUNITY_Decorative Tree Image|Decorative Tree Image]]
- [[_COMMUNITY_Jacket Product Image|Jacket Product Image]]
- [[_COMMUNITY_Image Upload Logic|Image Upload Logic]]
- [[_COMMUNITY_Page Schema Migration|Page Schema Migration]]
- [[_COMMUNITY_Outerwear Lifestyle Image|Outerwear Lifestyle Image]]
- [[_COMMUNITY_Postbuild Deployment|Postbuild Deployment]]
- [[_COMMUNITY_Backend README|Backend README]]
- [[_COMMUNITY_Rich Text Editor|Rich Text Editor]]
- [[_COMMUNITY_Admin Pages Screen|Admin Pages Screen]]
- [[_COMMUNITY_Seed Script Entry|Seed Script Entry]]
- [[_COMMUNITY_Page Module Service|Page Module Service]]
- [[_COMMUNITY_Jest Config|Jest Config]]
- [[_COMMUNITY_OpenTelemetry Setup|OpenTelemetry Setup]]
- [[_COMMUNITY_Medusa Config File|Medusa Config File]]
- [[_COMMUNITY_Test Setup|Test Setup]]
- [[_COMMUNITY_Health Test|Health Test]]
- [[_COMMUNITY_Vite Env Types|Vite Env Types]]
- [[_COMMUNITY_Admin SDK Client|Admin SDK Client]]
- [[_COMMUNITY_Admin I18n Index|Admin I18n Index]]
- [[_COMMUNITY_Update Page Workflow File|Update Page Workflow File]]
- [[_COMMUNITY_Delete Page Workflow File|Delete Page Workflow File]]
- [[_COMMUNITY_Create Page Workflow File|Create Page Workflow File]]
- [[_COMMUNITY_Update Page Step File|Update Page Step File]]
- [[_COMMUNITY_Delete Page Step File|Delete Page Step File]]
- [[_COMMUNITY_Create Page Step File|Create Page Step File]]
- [[_COMMUNITY_Postbuild Script File|Postbuild Script File]]
- [[_COMMUNITY_API Middleware Registry|API Middleware Registry]]
- [[_COMMUNITY_Admin Pages Middleware|Admin Pages Middleware]]
- [[_COMMUNITY_Store Pages Middleware|Store Pages Middleware]]
- [[_COMMUNITY_Page Module Index|Page Module Index]]
- [[_COMMUNITY_Page Entity Model|Page Entity Model]]
- [[_COMMUNITY_MinIO Module Index|MinIO Module Index]]

## God Nodes (most connected - your core abstractions)
1. `MinioFileProviderService` - 10 edges
2. `GET()` - 7 edges
3. `Pages Admin Route` - 7 edges
4. `Custom Modules` - 7 edges
5. `Admin SDK Session Client` - 6 edges
6. `Page Form` - 6 edges
7. `Create Page Step` - 6 edges
8. `Update Page Step` - 6 edges
9. `Custom API Routes` - 6 edges
10. `Admin Page Detail API` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Server Dependency Install` --conceptually_related_to--> `Page Module Service`  [AMBIGUOUS]
  backend/src/scripts/postBuild.js → backend/src/workflows/steps/create-page.ts
- `Admin I18n Placeholder` --conceptually_related_to--> `Pages Admin Route`  [AMBIGUOUS]
  backend/src/admin/i18n/index.ts → backend/src/admin/routes/pages/page.tsx
- `Update Page Workflow` --semantically_similar_to--> `Delete Page Workflow`  [INFERRED] [semantically similar]
  backend/src/workflows/update-page.ts → backend/src/workflows/delete-page.ts
- `Admin Pages API` --semantically_similar_to--> `Store Pages API`  [INFERRED] [semantically similar]
  backend/src/api/admin/pages/route.ts → backend/src/api/store/pages/route.ts
- `Admin Page Detail API` --semantically_similar_to--> `Store Page By Slug API`  [INFERRED] [semantically similar]
  backend/src/api/admin/pages/[id]/route.ts → backend/src/api/store/pages/[slug]/route.ts

## Hyperedges (group relationships)
- **Page CRUD Surface** — route_admin_pages_api, route_admin_page_detail_api, page_service_page_module_service, page_model_page_entity [EXTRACTED 1.00]
- **Storefront Page Delivery** — route_store_pages_api, route_store_page_by_slug_api, page_model_page_entity, middlewares_store_page_query_validation [INFERRED 0.90]
- **Storage Bootstrap Flow** — medusa-config_minio_file_provider, minio_service_bucket_bootstrap, minio_service_public_asset_storage, minio_service_presigned_access [EXTRACTED 1.00]
- **Admin Page Authoring Surface** — page_pages_admin_route, page_page_form, image-upload_image_upload_component, rich-text-editor_rich_text_editor_component [EXTRACTED 1.00]
- **Page Workflow Lifecycle** — create-page_create_page_workflow, update-page_update_page_workflow, delete-page_delete_page_workflow [INFERRED 0.84]
- **Page Module Service Operations** — create-page_create_page_step, update-page_update_page_step, delete-page_delete_page_step, create-page_page_module_service [EXTRACTED 1.00]
- **Admin Extension Surface** — admin_readme_admin_customizations, admin_readme_widgets, admin_i18n_readme_admin_translations, admin_i18n_readme_react_i18next [EXTRACTED 1.00]
- **Backend Execution Entrypoints** — api_readme_api_routes, workflows_readme_workflows, scripts_readme_cli_scripts, subscribers_readme_subscribers, jobs_readme_scheduled_jobs [INFERRED 0.79]
- **MinIO Storage Behavior** — minio_file_readme_minio_provider, minio_file_readme_public_read_access, minio_file_readme_local_storage_fallback, minio_file_readme_presigned_urls [EXTRACTED 1.00]
- **Outerwear Lifestyle Product Staging** — 1772827266162-46384_outerwear_product_photo, 1772827266162-46384_black_puffer_parka, 1772827266162-46384_autumn_outdoor_lifestyle_setting, 1772827266162-46384_male_model [INFERRED 0.86]
- **Bedroom Hospitality Layout** — 1773364983488-a37a5a_76c50f9ff6394e0f92692db0e85bb3e0~mv2_modern_bedroom, 1773364983488-a37a5a_76c50f9ff6394e0f92692db0e85bb3e0~mv2_ambient_lighting, 1773364983488-a37a5a_76c50f9ff6394e0f92692db0e85bb3e0~mv2_floor_to_ceiling_window, 1773364983488-a37a5a_76c50f9ff6394e0f92692db0e85bb3e0~mv2_integrated_workspace [INFERRED 0.78]
- **Biophilic Atrium Elements** — 1772994322439_big_artiicial_olive_trees_and_fr_planting_office_atrium, 1772994322439_big_artiicial_olive_trees_and_fr_planting_indoor_olive_tree, 1772994322439_big_artiicial_olive_trees_and_fr_planting_cascading_planters, 1772994322439_big_artiicial_olive_trees_and_fr_planting_biophilic_design [INFERRED 0.88]
- **Decorative Tree Interior Staging** — 1773336392735-lorem_decorative_blossom_tree, 1773336392735-lorem_pink_floral_canopy, 1773336392735-lorem_matte_round_planter, 1773336392735-lorem_modern_living_room, 1773336392735-lorem_interior_staging [INFERRED 0.84]
- **Zip Jacket Product Staging** — 1772827266167-2533_studio_product_photo, 1772827266167-2533_heather_gray_zip_jacket, 1772827266167-2533_front_zip_closure, 1772827266167-2533_minimal_white_background [INFERRED 0.88]

## Communities

### Community 0 - "Page Admin Workflows"
Cohesion: 0.13
Nodes (25): Admin SDK Session Client, Create Page Step, Create Page Workflow, Page Creation Compensation, Page Module Service, Delete Page Step, Delete Page Workflow, Admin File Upload Mutation (+17 more)

### Community 1 - "Admin Extension Docs"
Cohesion: 0.17
Nodes (16): Admin Translations, react-i18next, Admin Customizations, Admin Widgets, Custom API Routes, API Middleware, req.scope Container Access, Integration Tests (+8 more)

### Community 2 - "Core Backend Config"
Cohesion: 0.13
Nodes (15): Health Endpoint Check, OpenTelemetry Observability, Backend Configuration, Local File Fallback, MinIO File Provider, Page Module Registration, MinIO Bucket Bootstrap, Protocol Stripping For MinIO Client (+7 more)

### Community 3 - "Page API Data Model"
Cohesion: 0.2
Nodes (14): Admin Page Validation, API Route Registry, Store Page Query Validation, Page Table Schema, Page Module, Page Entity, Page Module Service, Admin Page Detail API (+6 more)

### Community 4 - "MinIO Service Methods"
Cohesion: 0.2
Nodes (1): MinioFileProviderService

### Community 5 - "Module Storage Docs"
Cohesion: 0.24
Nodes (11): Module Isolation, Module Links, Cached Configuration Reset, Local Storage Fallback, MinIO File Provider Module, Presigned File URLs, Public Read Access, Custom Modules (+3 more)

### Community 6 - "Route Handlers"
Cohesion: 0.22
Nodes (2): GET(), POST()

### Community 7 - "Biophilic Atrium Image"
Cohesion: 0.47
Nodes (6): Amphitheater Seating, Biophilic Interior Design, Cascading Balcony Planters, Indoor Olive Tree, Office Atrium, Open Stair Circulation

### Community 8 - "Bedroom Staging Image"
Cohesion: 0.6
Nodes (5): Ambient Accent Lighting, Floor-to-Ceiling Window Treatment, Hospitality Listing Staging, Compact Desk Area, Modern Bedroom Interior

### Community 9 - "Decorative Tree Image"
Cohesion: 0.7
Nodes (5): Decorative Blossom Tree, Interior Design Staging, Matte Round Planter, Modern Living Room Interior, Pink Floral Canopy

### Community 10 - "Jacket Product Image"
Cohesion: 0.6
Nodes (5): Front Zip Closure, Heather Gray Zip Jacket, Minimal White Background, Stand Collar, Studio Product Photo

### Community 11 - "Image Upload Logic"
Cohesion: 0.67
Nodes (2): handleDrop(), handleFile()

### Community 12 - "Page Schema Migration"
Cohesion: 0.5
Nodes (1): Migration20260307191714

### Community 13 - "Outerwear Lifestyle Image"
Cohesion: 0.83
Nodes (4): Autumn Outdoor Lifestyle Setting, Black Puffer Parka, Male Model, Outerwear Product Photo

### Community 14 - "Postbuild Deployment"
Cohesion: 0.67
Nodes (3): Deployment Artifact Copy, Medusa Server Build Guard, Server Dependency Install

### Community 15 - "Backend README"
Cohesion: 0.67
Nodes (3): AI Agent Support, Commerce Modules, Medusa

### Community 16 - "Rich Text Editor"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Admin Pages Screen"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Seed Script Entry"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Page Module Service"
Cohesion: 1.0
Nodes (1): PageModuleService

### Community 20 - "Jest Config"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "OpenTelemetry Setup"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Medusa Config File"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Test Setup"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Health Test"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Vite Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Admin SDK Client"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Admin I18n Index"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Update Page Workflow File"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Delete Page Workflow File"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Create Page Workflow File"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Update Page Step File"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Delete Page Step File"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Create Page Step File"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Postbuild Script File"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "API Middleware Registry"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Admin Pages Middleware"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Store Pages Middleware"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Page Module Index"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Page Entity Model"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "MinIO Module Index"
Cohesion: 1.0
Nodes (0): 

## Ambiguous Edges - Review These
- `Admin I18n Placeholder` → `Pages Admin Route`  [AMBIGUOUS]
  backend/src/admin/i18n/index.ts · relation: conceptually_related_to
- `Page Module Service` → `Server Dependency Install`  [AMBIGUOUS]
  backend/src/scripts/postBuild.js · relation: conceptually_related_to

## Knowledge Gaps
- **31 isolated node(s):** `PageModuleService`, `Local File Fallback`, `Page Table Schema`, `Create Page Workflow`, `Update Page Workflow` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Rich Text Editor`** (2 nodes): `rich-text-editor.tsx`, `RichTextEditor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Pages Screen`** (2 nodes): `page.tsx`, `PagesRoute()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Seed Script Entry`** (2 nodes): `seed.ts`, `seedDemoData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Module Service`** (2 nodes): `service.ts`, `PageModuleService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Jest Config`** (1 nodes): `jest.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OpenTelemetry Setup`** (1 nodes): `instrumentation.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Medusa Config File`** (1 nodes): `medusa-config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Setup`** (1 nodes): `setup.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Health Test`** (1 nodes): `health.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Env Types`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin SDK Client`** (1 nodes): `client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin I18n Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Update Page Workflow File`** (1 nodes): `update-page.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Delete Page Workflow File`** (1 nodes): `delete-page.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Create Page Workflow File`** (1 nodes): `create-page.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Update Page Step File`** (1 nodes): `update-page.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Delete Page Step File`** (1 nodes): `delete-page.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Create Page Step File`** (1 nodes): `create-page.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Postbuild Script File`** (1 nodes): `postBuild.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Middleware Registry`** (1 nodes): `middlewares.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Pages Middleware`** (1 nodes): `middlewares.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Store Pages Middleware`** (1 nodes): `middlewares.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Module Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Entity Model`** (1 nodes): `page.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MinIO Module Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Admin I18n Placeholder` and `Pages Admin Route`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Page Module Service` and `Server Dependency Install`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Custom Modules` connect `Module Storage Docs` to `Admin Extension Docs`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Custom Modules` (e.g. with `Module Links` and `MinIO File Provider Module`) actually correct?**
  _`Custom Modules` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PageModuleService`, `Local File Fallback`, `Page Table Schema` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Page Admin Workflows` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Core Backend Config` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._