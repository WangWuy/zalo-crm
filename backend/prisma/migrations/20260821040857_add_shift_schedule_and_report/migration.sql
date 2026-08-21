-- CreateTable
CREATE TABLE "shift_schedules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_hour" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL DEFAULT 0,
    "end_hour" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL DEFAULT 0,
    "report_deadline_minutes_before_end" INTEGER NOT NULL DEFAULT 0,
    "alert_minutes_before" JSONB NOT NULL DEFAULT '[30,15]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_reports" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "report_date" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "shift_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_schedules_org_id_is_active_idx" ON "shift_schedules"("org_id", "is_active");

-- CreateIndex
CREATE INDEX "shift_reports_org_id_user_id_report_date_idx" ON "shift_reports"("org_id", "user_id", "report_date" DESC);

-- CreateIndex
CREATE INDEX "shift_reports_org_id_report_date_is_late_idx" ON "shift_reports"("org_id", "report_date", "is_late");

-- CreateIndex
CREATE UNIQUE INDEX "shift_reports_org_id_user_id_shift_id_report_date_key" ON "shift_reports"("org_id", "user_id", "shift_id", "report_date");

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shift_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
