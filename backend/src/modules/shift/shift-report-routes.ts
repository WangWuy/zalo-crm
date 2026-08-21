// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * shift-report-routes.ts — Phase 1 Ca làm việc & Báo cáo ca 2026-08-21.
 *
 * GET  /api/v1/shifts/current       — ca đang diễn ra + deadline + đã nộp chưa
 * POST /api/v1/shifts/reports       — nộp báo cáo ca/ngày (idempotent theo ngày — PATCH nếu đã có)
 * GET  /api/v1/shifts/reports       — lịch sử, RBAC theo getOwnerScope
 * GET  /api/v1/shifts/reports/:id   — chi tiết 1 báo cáo
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { getOwnerScope, applyOwnerScope } from '../rbac/owner-scope.js';
import { resolveActiveShift, reportDateVN } from './shift-schedule-service.js';

export async function registerShiftReportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /api/v1/shifts/current
  app.get('/current', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user!;
    const now = new Date();
    const active = await resolveActiveShift(user.orgId, now);
    if (!active) return reply.send({ shift: null });

    const today = reportDateVN(now);
    const existing = await prisma.shiftReport.findUnique({
      where: {
        orgId_userId_shiftId_reportDate: {
          orgId: user.orgId,
          userId: user.id,
          shiftId: active.id,
          reportDate: today,
        },
      },
      select: { id: true },
    });

    return reply.send({
      shift: {
        id: active.id,
        name: active.name,
        deadlineAt: active.deadlineAt.toISOString(),
        alertMinutesBefore: active.alertMinutesBefore,
      },
      hasSubmittedToday: !!existing,
    });
  });

  // POST /api/v1/shifts/reports
  // Idempotent theo ngày. Postgres coi NULL != NULL trong unique index, nên khi
  // shiftId=null (không có ca active lúc nộp) `upsert` qua compound key KHÔNG chặn
  // trùng — tra `findFirst` thủ công trước rồi create/update thay vì dựa vào upsert.
  app.post('/reports', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user!;
    const body = (req.body ?? {}) as { metrics?: Record<string, unknown>; note?: string };
    const now = new Date();
    const active = await resolveActiveShift(user.orgId, now);
    const today = reportDateVN(now);
    const isLate = active ? now.getTime() > active.deadlineAt.getTime() : false;
    const shiftId = active?.id ?? null;

    const existing = await prisma.shiftReport.findFirst({
      where: { orgId: user.orgId, userId: user.id, shiftId, reportDate: today },
      select: { id: true },
    });

    const report = existing
      ? await prisma.shiftReport.update({
          where: { id: existing.id },
          data: { metrics: body.metrics ?? {}, note: body.note ?? null, isLate },
        })
      : await prisma.shiftReport.create({
          data: {
            orgId: user.orgId,
            userId: user.id,
            shiftId,
            reportDate: today,
            metrics: body.metrics ?? {},
            note: body.note ?? null,
            isLate,
          },
        });
    return reply.send({ report });
  });

  // GET /api/v1/shifts/reports?userId=&from=&to=
  app.get('/reports', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user!;
    const query = (req.query ?? {}) as { userId?: string; from?: string; to?: string };

    const scope = await getOwnerScope({
      userId: user.id,
      orgId: user.orgId,
      legacyRole: user.role,
      resource: 'engagement_score',
    });
    if (!scope.canViewAll && query.userId && !scope.visibleUserIds.includes(query.userId)) {
      return reply.status(403).send({ error: 'Không có quyền xem báo cáo của người này' });
    }

    const where: Record<string, unknown> = {
      orgId: user.orgId,
      ...applyOwnerScope(scope, 'userId'),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? { reportDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
        : {}),
    };

    const reports = await prisma.shiftReport.findMany({
      where,
      orderBy: { reportDate: 'desc' },
      include: { user: { select: { id: true, fullName: true } }, shift: { select: { id: true, name: true } } },
    });
    return reply.send({ reports });
  });

  // GET /api/v1/shifts/reports/:id
  app.get('/reports/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const report = await prisma.shiftReport.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true } }, shift: { select: { id: true, name: true } } },
    });
    if (!report || report.orgId !== user.orgId) return reply.code(404).send({ error: 'REPORT_NOT_FOUND' });

    if (report.userId !== user.id) {
      const scope = await getOwnerScope({
        userId: user.id,
        orgId: user.orgId,
        legacyRole: user.role,
        resource: 'engagement_score',
      });
      if (!scope.canViewAll && !scope.visibleUserIds.includes(report.userId)) {
        return reply.status(403).send({ error: 'Không có quyền xem báo cáo này' });
      }
    }
    return reply.send({ report });
  });
}
