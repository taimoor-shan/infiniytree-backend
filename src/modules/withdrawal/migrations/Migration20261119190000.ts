import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261119190000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "withdrawal_request" ("id" text not null, "status" text check ("status" in ('new', 'handled')) not null default 'new', "name" text not null, "email" text not null, "order_number" text not null, "order_id" text null, "order_display_id" integer null, "items" text null, "message" text null, "locale" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "withdrawal_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_withdrawal_request_deleted_at" ON "withdrawal_request" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "withdrawal_request" cascade;`);
  }

}
