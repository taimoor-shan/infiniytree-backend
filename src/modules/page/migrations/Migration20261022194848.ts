import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261022194848 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "page" add column if not exists "template" text not null default 'default';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "page" drop column if exists "template";`);
  }

}
