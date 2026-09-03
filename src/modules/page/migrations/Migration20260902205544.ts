import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260902205544 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "page" add column if not exists "hero_video_url" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "page" drop column if exists "hero_video_url";`);
  }

}
