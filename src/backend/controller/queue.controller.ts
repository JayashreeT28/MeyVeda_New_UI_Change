import { NextRequest, NextResponse } from "next/server";
import { QueueService } from "../service/queue.service";
import { requireAuth } from "@/shared/auth/require-auth";
import { AppError } from "@/shared/api/api-error";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Internal server error";
}

export async function getTodayQueueController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await QueueService.getTodayQueue(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getTodayQueueController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}

export async function getUpcomingAppointmentsController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await QueueService.getUpcomingAppointments(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getUpcomingAppointmentsController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}
