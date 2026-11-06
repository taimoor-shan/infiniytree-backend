import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106191630 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "delivery_request" add column if not exists "sales_rep_ref" text null, add column if not exists "sales_rep_name" text null;`);
    this.addSql(`alter table if exists "delivery_request" alter column "email" type text using ("email"::text);`);
    this.addSql(`alter table if exists "delivery_request" alter column "email" drop not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "delivery_request" drop column if exists "sales_rep_ref", drop column if exists "sales_rep_name";`);

    this.addSql(`alter table if exists "delivery_request" alter column "email" type text using ("email"::text);`);
    this.addSql(`alter table if exists "delivery_request" alter column "email" set not null;`);
  }

}
