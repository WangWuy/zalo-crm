// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * shift-schedule-routes.ts — Phase 1 Ca làm việc & Báo cáo ca 2026-08-21.
 *
 * CRUD `ShiftSchedule` (admin). Cấu hình ca CHUNG TOÀN ORG.
 *
 * GET    /api/v1/shifts/schedules      — list toàn bộ ca của org
 * POST   /api/v1/shifts/schedules      — tạo ca mới (admin)
 * PATCH  /api/v1/shifts/schedules/:id  — sửa ca (admin)
 * DELETE /api/v1/shifts/schedules/:id  — archive (soft delete, admin)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireGrant } from '../rbac/rbac-middleware.js';

export async function registerShiftScheduleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user!;
    const schedules = await prisma.shiftSchedule.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: [{ startHour: 'asc' }, { startMinute: 'asc' }],
    });
    return reply.send({ schedules });
  });

  app.post(
    '/',
    { preHandler: requireGrant('settings', 'create') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user!;
      const body = (req.body ?? {}) as {
        name?: string;
        startHour?: number;
        startMinute?: number;
        endHour?: number;
        endMinute?: number;
        reportDeadlineMinutesBeforeEnd?: number;
        alertMinutesBefore?: number[];
      };
      const name = (body.name || '').trim();
      if (!name) return reply.code(400).send({ error: 'MISSING_NAME' });
      if (body.startHour == null || body.endHour == null) {
        return reply.code(400).send({ error: 'MISSING_HOURS' });
      }

      const schedule = await prisma.shiftSchedule.create({
        data: {
          orgId: user.orgId,
          name,
          startHour: body.startHour,
          startMinute: body.startMinute ?? 0,
          endHour: body.endHour,
          endMinute: body.endMinute ?? 0,
          reportDeadlineMinutesBeforeEnd: body.reportDeadlineMinutesBeforeEnd ?? 0,
          alertMinutesBefore: body.alertMinutesBefore ?? [30, 15],
        },
      });
      return reply.send({ schedule });
    },
  );

  app.patch(
    '/:id',
    { preHandler: requireGrant('settings', 'edit') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user!;
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as {
        name?: string;
        startHour?: number;
        startMinute?: number;
        endHour?: number;
        endMinute?: number;
        reportDeadlineMinutesBeforeEnd?: number;
        alertMinutesBefore?: number[];
        isActive?: boolean;
      };
      const schedule = await prisma.shiftSchedule.findUnique({ where: { id } });
      if (!schedule || schedule.orgId !== user.orgId) {
        return reply.code(404).send({ error: 'SCHEDULE_NOT_FOUND' });
      }

      const updated = await prisma.shiftSchedule.update({
        where: { id: schedule.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.startHour !== undefined ? { startHour: body.startHour } : {}),
          ...(body.startMinute !== undefined ? { startMinute: body.startMinute } : {}),
          ...(body.endHour !== undefined ? { endHour: body.endHour } : {}),
          ...(body.endMinute !== undefined ? { endMinute: body.endMinute } : {}),
          ...(body.reportDeadlineMinutesBeforeEnd !== undefined
            ? { reportDeadlineMinutesBeforeEnd: body.reportDeadlineMinutesBeforeEnd }
            : {}),
          ...(body.alertMinutesBefore !== undefined ? { alertMinutesBefore: body.alertMinutesBefore } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      return reply.send({ schedule: updated });
    },
  );

  app.delete(
    '/:id',
    { preHandler: requireGrant('settings', 'edit') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user!;
      const { id } = req.params as { id: string };
      const schedule = await prisma.shiftSchedule.findUnique({ where: { id } });
      if (!schedule || schedule.orgId !== user.orgId) {
        return reply.code(404).send({ error: 'SCHEDULE_NOT_FOUND' });
      }
      await prisma.shiftSchedule.update({ where: { id: schedule.id }, data: { isActive: false } });
      return reply.send({ ok: true });
    },
  );
}
