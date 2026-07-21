import { NextRequest, NextResponse } from "next/server";
import { AdminService } from "../service/admin.service";
import { requireAuth } from "@/shared/auth/require-auth";
import { AppError } from "@/shared/api/api-error";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Internal server error";
}

function getStatusCode(error: unknown, fallback: number): number {
  return error instanceof AppError ? error.statusCode : fallback;
}

export async function getDashboardStatsController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await AdminService.getDashboardStats(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getDashboardStatsController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 500) });
  }
}

export async function getPractitionersController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await AdminService.getPractitioners(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getPractitionersController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 500) });
  }
}

export async function createPractitionerController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const body = await req.json();
    await AdminService.createPractitioner(authUser, body);
    return NextResponse.json({ success: true, message: "Practitioner created successfully" }, { status: 201 });
  } catch (error: unknown) {
    console.error("createPractitionerController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 400) });
  }
}

export async function verifyPractitionerController(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    await AdminService.verifyPractitioner(authUser, id, body.status, body.reason);
    return NextResponse.json({ success: true, message: "Practitioner verification updated" });
  } catch (error: unknown) {
    console.error("verifyPractitionerController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 400) });
  }
}

export async function getPatientsController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await AdminService.getPatients(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getPatientsController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 500) });
  }
}

export async function createPatientController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const body = await req.json();
    await AdminService.createPatient(authUser, body);
    return NextResponse.json({ success: true, message: "Patient created successfully" }, { status: 201 });
  } catch (error: unknown) {
    console.error("createPatientController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 400) });
  }
}

export async function togglePatientStatusController(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    await AdminService.togglePatientStatus(authUser, id, body.isActive);
    return NextResponse.json({ success: true, message: "Patient status updated" });
  } catch (error: unknown) {
    console.error("togglePatientStatusController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 400) });
  }
}

export async function getAdminOrdersController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await AdminService.getOrders(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getAdminOrdersController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 500) });
  }
}

export async function updateAdminOrderStatusController(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    await AdminService.updateOrderStatus(authUser, id, body.status, body.trackingNumber, body.logisticsPartner);
    return NextResponse.json({ success: true, message: "Order status updated" });
  } catch (error: unknown) {
    console.error("updateAdminOrderStatusController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 400) });
  }
}

export async function getClinicsController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await AdminService.getClinics(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("getClinicsController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 500) });
  }
}

export async function createClinicController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const body = await req.json();
    await AdminService.createClinic(authUser, body);
    return NextResponse.json({ success: true, message: "Clinic created successfully" }, { status: 201 });
  } catch (error: unknown) {
    console.error("createClinicController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 400) });
  }
}

export async function toggleClinicActiveController(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    await AdminService.toggleClinicActive(authUser, id, body.isActive);
    return NextResponse.json({ success: true, message: "Clinic status updated" });
  } catch (error: unknown) {
    console.error("toggleClinicActiveController error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: getStatusCode(error, 400) });
  }
}
