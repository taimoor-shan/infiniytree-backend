import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261105060630 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "delivery_request" ("id" text not null, "status" text check ("status" in ('new', 'handled')) not null default 'new', "email" text not null, "first_name" text null, "last_name" text null, "company" text null, "vat_number" text null, "phone" text null, "address_1" text null, "address_2" text null, "postal_code" text null, "city" text null, "province" text null, "country_code" text not null, "message" text null, "locale" text null, "cart_id" text null, "currency_code" text null, "item_subtotal" real null, "items" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_request_deleted_at" ON "delivery_request" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "delivery_request" cascade;`);
  }

}
