import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260703AddLocale extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "page" add column if not exists "locale" text not null default 'en';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "page" drop column if exists "locale";`);
  }

}
