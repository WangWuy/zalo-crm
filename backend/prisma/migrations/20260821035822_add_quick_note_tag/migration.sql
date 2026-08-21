-- DropIndex
DROP INDEX "contacts_pool_robin_idx";

-- DropIndex
DROP INDEX "zalo_accounts_org_id_archived_at_idx";

-- AlterTable
ALTER TABLE "automation_triggers" ALTER COLUMN "welcome_delay_seconds" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "lead_notify_acks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "quick_note_tags" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_note_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quick_note_tags_org_id_is_active_order_idx" ON "quick_note_tags"("org_id", "is_active", "order");

-- CreateIndex
CREATE INDEX "contacts_org_id_pooled_count_last_pooled_at_idx" ON "contacts"("org_id", "pooled_count", "last_pooled_at");

-- AddForeignKey
ALTER TABLE "quick_note_tags" ADD CONSTRAINT "quick_note_tags_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_source_zalo_account_id_fkey" FOREIGN KEY ("source_zalo_account_id") REFERENCES "zalo_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "lead_pool_distributions_org_id_assigned_to_user_id_distributed_" RENAME TO "lead_pool_distributions_org_id_assigned_to_user_id_distribu_idx";
