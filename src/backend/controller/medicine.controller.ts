import { NextRequest, NextResponse } from "next/server";
import { MedicineService } from "../service/medicine.service";
import { requireAuth } from "@/shared/auth/require-auth";
import { AppError } from "@/shared/api/api-error";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Internal server error";
}

export async function searchMedicinesController(req: NextRequest) {
  try {
    await requireAuth(req);
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const data = await MedicineService.search(search);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("searchMedicinesController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}

export async function adminGetMedicinesController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await MedicineService.getAll(authUser);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("adminGetMedicinesController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}

export async function adminCreateMedicineController(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const body = await req.json();
    await MedicineService.create(authUser, body);
    return NextResponse.json({ success: true, message: "Medicine created successfully" }, { status: 201 });
  } catch (error: unknown) {
    console.error("adminCreateMedicineController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 400;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}

export async function adminUpdateMedicineController(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();

    if (body.action === "toggleActive") {
      await MedicineService.toggleActive(authUser, id, body.isActive);
      return NextResponse.json({ success: true, message: "Medicine status updated successfully" });
    }

    await MedicineService.update(authUser, id, body);
    return NextResponse.json({ success: true, message: "Medicine updated successfully" });
  } catch (error: unknown) {
    console.error("adminUpdateMedicineController error:", error);
    const statusCode = error instanceof AppError ? error.statusCode : 400;
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: statusCode });
  }
}
