import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261030212438 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "shipping_rate_table" drop constraint if exists "shipping_rate_table_shipping_class_country_code_unique";`);
    this.addSql(`alter table if exists "shipping_rate_currency" drop constraint if exists "shipping_rate_currency_currency_code_unique";`);
    this.addSql(`create table if not exists "shipping_rate_currency" ("id" text not null, "currency_code" text not null, "rate" real not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipping_rate_currency_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipping_rate_currency_deleted_at" ON "shipping_rate_currency" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipping_rate_currency_currency_code_unique" ON "shipping_rate_currency" ("currency_code") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "shipping_rate_table" ("id" text not null, "shipping_class" text not null, "country_code" text not null, "zones" jsonb not null, "tiers" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipping_rate_table_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipping_rate_table_deleted_at" ON "shipping_rate_table" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipping_rate_table_shipping_class_country_code_unique" ON "shipping_rate_table" ("shipping_class", "country_code") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "shipping_rate_currency" cascade;`);

    this.addSql(`drop table if exists "shipping_rate_table" cascade;`);
  }

}
