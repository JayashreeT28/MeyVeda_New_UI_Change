import { NextRequest } from "next/server";
import {
  getAppointmentsController,
  createAppointmentController,
  cancelAppointmentController,
} from "@/backend/controller/appointments.controller";
import { withErrorHandler } from "@/backend/middleware/error.middleware";

export const GET = withErrorHandler(async (req: NextRequest) => {
  return getAppointmentsController(req);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  return createAppointmentController(req);
});

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  return cancelAppointmentController(req);
});
