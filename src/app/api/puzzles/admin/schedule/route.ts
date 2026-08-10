import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ScheduleRequestBody {
  puzzlesPerDay: number;
  isActive: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ScheduleRequestBody = await request.json();
    const { puzzlesPerDay, isActive } = body;

    if (puzzlesPerDay === undefined || isActive === undefined) {
      return NextResponse.json(
        { error: 'Missing puzzlesPerDay or isActive' },
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
