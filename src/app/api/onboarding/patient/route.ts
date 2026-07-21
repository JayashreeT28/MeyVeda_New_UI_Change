/**
 * POST /api/onboarding/patient
 *
 * Thin route handler — delegates to onboarding controller.
 */
import { NextRequest } from "next/server";
import { createPatient } from "@/backend/controller/onboarding.controller";
import { withErrorHandler } from "@/backend/middleware/error.middleware";

export const POST = withErrorHandler((req: NextRequest) => createPatient(req));
