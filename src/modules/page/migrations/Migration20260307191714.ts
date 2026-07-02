import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260307191714 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "page" ("id" text not null, "title" text not null, "slug" text not null, "content" text null, "excerpt" text null, "featured_image" text null, "seo_title" text null, "seo_description" text null, "status" text not null default 'draft', "is_public" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "page_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_page_deleted_at" ON "page" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "page" cascade;`);
  }

}
