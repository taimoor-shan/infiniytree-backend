import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261030185728 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "notify_me_request" ("id" text not null, "email" text not null, "product_id" text not null, "variant_id" text null, "product_title" text null, "variant_title" text null, "product_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "notify_me_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_notify_me_request_deleted_at" ON "notify_me_request" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "notify_me_request" cascade;`);
  }

}
