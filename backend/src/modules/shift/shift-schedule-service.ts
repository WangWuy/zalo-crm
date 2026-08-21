// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * shift-schedule-service.ts — Phase 1 Ca làm việc & Báo cáo ca 2026-08-21.
 *
 * Helper tính ca "đang diễn ra" hiện tại + deadline nộp báo cáo. Ca cấu hình
 * CHUNG TOÀN ORG (không phân theo team/user — xem implementation_plan.md mục 1.2).
 */
import { prisma } from '../../shared/database/prisma-client.js';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "YYYY-MM-DD" theo giờ VN cho 1 thời điểm cho trước (mặc định now). */
export function reportDateVN(at: Date = new Date()): string {
  const vnNow = new Date(at.getTime() + VN_OFFSET_MS);
  const y = vnNow.getFullYear();
  const m = String(vnNow.getMonth() + 1).padStart(2, '0');
  const d = String(vnNow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Số phút trong ngày (giờ VN) của 1 thời điểm, dùng để so sánh với start/end ca. */
function minutesOfDayVN(at: Date): number {
  const vnNow = new Date(at.getTime() + VN_OFFSET_MS);
  return vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();
}

export interface ActiveShift {
  id: string;
  orgId: string;
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  reportDeadlineMinutesBeforeEnd: number;
  alertMinutesBefore: number[];
  /** Thời điểm deadline nộp báo cáo (ISO), tính theo ngày `now` hiện tại. */
  deadlineAt: Date;
}

/**
 * Tìm ca active mà `now` đang nằm trong khoảng [start, end) — xử lý ca qua đêm
 * (vd 22:00-06:00) bằng so sánh phút-trong-ngày dạng modulo. Nếu 2 ca active
 * trùng giờ, lấy ca có startHour gần nhất với "now" (đơn giản hoá Phase 1 —
 * không cần UI chọn ca thủ công). Trả `null` nếu không ca nào khớp (khoảng trống).
 */
export async function resolveActiveShift(orgId: string, now: Date = new Date()): Promise<ActiveShift | null> {
  const shifts = await prisma.shiftSchedule.findMany({
    where: { orgId, isActive: true },
  });
  if (shifts.length === 0) return null;

  const nowMin = minutesOfDayVN(now);
  const matches: Array<{ shift: (typeof shifts)[number]; startMin: number; endMin: number }> = [];

  for (const shift of shifts) {
    const startMin = shift.startHour * 60 + shift.startMinute;
    const endMin = shift.endHour * 60 + shift.endMinute;
    const inRange = startMin <= endMin
      ? nowMin >= startMin && nowMin < endMin
      : nowMin >= startMin || nowMin < endMin; // ca qua đêm
    if (inRange) matches.push({ shift, startMin, endMin });
  }
  if (matches.length === 0) return null;

  // Nhiều ca trùng giờ → lấy ca có startMin gần nhất với now (khoảng cách ngắn nhất).
  matches.sort((a, b) => {
    const da = Math.min(Math.abs(nowMin - a.startMin), 1440 - Math.abs(nowMin - a.startMin));
    const db = Math.min(Math.abs(nowMin - b.startMin), 1440 - Math.abs(nowMin - b.startMin));
    return da - db;
  });
  const { shift, startMin, endMin } = matches[0];

  // Tính deadlineAt: thời điểm kết thúc ca (theo ngày VN hiện tại), trừ đi
  // reportDeadlineMinutesBeforeEnd. Nếu ca qua đêm và end < start, end thuộc "ngày mai" VN.
  const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
  const baseVNDate = new Date(Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate()));
  const crossesMidnight = endMin <= startMin;
  const endDateVN = crossesMidnight && nowMin >= startMin
    ? new Date(baseVNDate.getTime() + 24 * 60 * 60 * 1000)
    : baseVNDate;
  const endAtVN = new Date(endDateVN.getTime() + endMin * 60 * 1000);
  const endAtUTC = new Date(endAtVN.getTime() - VN_OFFSET_MS);
  const deadlineAt = new Date(endAtUTC.getTime() - shift.reportDeadlineMinutesBeforeEnd * 60 * 1000);

  return {
    id: shift.id,
    orgId: shift.orgId,
    name: shift.name,
    startHour: shift.startHour,
    startMinute: shift.startMinute,
    endHour: shift.endHour,
    endMinute: shift.endMinute,
    reportDeadlineMinutesBeforeEnd: shift.reportDeadlineMinutesBeforeEnd,
    alertMinutesBefore: Array.isArray(shift.alertMinutesBefore) ? (shift.alertMinutesBefore as number[]) : [30, 15],
    deadlineAt,
  };
}
