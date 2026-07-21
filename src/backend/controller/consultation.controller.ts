import { NextRequest, NextResponse } from "next/server";
import { ConsultationService } from "../service/consultation.service";
import { requireAuth } from "@/shared/auth/require-auth";
import { AppError } from "@/shared/api/api-error";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Internal server error";
}

export async function getDetailedConsultationsController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await ConsultationService.getDetailedConsultations(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getDetailedConsultationsController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}

export async function getConsultationReportController(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = await context.params;
    const data = await ConsultationService.getConsultationReportData(authUser, id);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getConsultationReportController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}

export async function saveCompleteConsultationController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const body = await req.json();
    await ConsultationService.saveCompleteConsultation(authUser, body);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("saveCompleteConsultationController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 400;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}

export async function getUpcomingCallsController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await ConsultationService.getUpcomingCalls(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getUpcomingCallsController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}

export async function getPatientIntakeDetailsController(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = await context.params;
    const data = await ConsultationService.getPatientIntakeDetails(authUser, id);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getPatientIntakeDetailsController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}
