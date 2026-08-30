import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-guard';

interface ScheduleRequestBody {
  puzzlesPerDay: number;
  isActive: boolean;
}

export async function POST(request: NextRequest) {
  const { error: authErr } = await requireRole('ADMIN');
  if (authErr) return authErr;

  try {
    const body: ScheduleRequestBody = await request.json();
    const { puzzlesPerDay, isActive } = body;

    if (!Number.isInteger(puzzlesPerDay) || puzzlesPerDay < 1 || puzzlesPerDay > 50 || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'puzzlesPerDay doit être compris entre 1 et 50 et isActive doit être booléen' },
        { status: 400 }
      );
    }

    // Find existing schedule or create one
    const existing = await db.publishingSchedule.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    let schedule;
    if (existing) {
      schedule = await db.publishingSchedule.update({
        where: { id: existing.id },
        data: {
          puzzlesPerDay,
          isActive,
        },
      });
    } else {
      schedule = await db.publishingSchedule.create({
        data: {
          puzzlesPerDay,
          isActive,
        },
      });
    }

    return NextResponse.json({
      schedule: {
        puzzlesPerDay: schedule.puzzlesPerDay,
        isActive: schedule.isActive,
      },
    });
  } catch (error) {
    console.error('Error updating publishing schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}
