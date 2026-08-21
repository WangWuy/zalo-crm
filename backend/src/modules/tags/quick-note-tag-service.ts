// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * quick-note-tag-service.ts — Seed default Quick Note Tag khi tạo org mới.
 */
import type { Prisma } from '@prisma/client';

const DEFAULT_QUICK_NOTE_TAGS = [
  'Thuê bao',
  'Không bắt máy',
  'Đang bận',
  'Hẹn tối gọi lại',
  'Sai số',
  'Không quan tâm',
  'Đã chuyển khoản',
  'Cần tư vấn thêm',
];

/** Idempotent: chỉ seed nếu org chưa có QuickNoteTag nào. */
export async function seedDefaultQuickNoteTags(
  tx: any,
  orgId: string,
): Promise<void> {
  const existing = await tx.quickNoteTag.count({ where: { orgId } });
  if (existing > 0) return;

  await tx.quickNoteTag.createMany({
    data: DEFAULT_QUICK_NOTE_TAGS.map((label, i) => ({ orgId, label, order: i })),
  });
}
