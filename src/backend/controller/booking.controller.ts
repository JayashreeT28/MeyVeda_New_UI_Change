import { NextRequest, NextResponse } from "next/server";
import { BookingService } from "../service/booking.service";
import type { BookAppointmentInput, SubmitRatingInput } from "../repo/booking.repo";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Internal server error";
}

export class BookingController {
  static async getAppointments(request: NextRequest) {
    try {
      const patientId = request.nextUrl.searchParams.get("patientId");

      if (!patientId) {
        return NextResponse.json(
          {
            success: false,
            error: "patientId is required",
          },
          { status: 400 },
        );
      }

      const data = await BookingService.getAppointments(patientId);

      return NextResponse.json({
        success: true,
        data,
      });
    } catch (error: unknown) {
      console.error("getAppointments error:", error);

      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(error),
        },
        { status: 500 },
      );
    }
  }

  static async bookAppointment(request: NextRequest) {
    try {
      const body = (await request.json()) as BookAppointmentInput;

      await BookingService.bookAppointment(body);

      return NextResponse.json(
        {
          success: true,
          message: "Appointment booked successfully",
        },
        { status: 201 },
      );
    } catch (error: unknown) {
      console.error("bookAppointment error:", error);

      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(error),
        },
        { status: 400 },
      );
    }
  }

  static async cancelAppointment(request: NextRequest) {
    try {
      const body = (await request.json()) as {
        appointmentId?: string;
        reason?: string;
      };

      await BookingService.cancelAppointment(
        body.appointmentId ?? "",
        body.reason ?? "",
      );

      return NextResponse.json({
        success: true,
        message: "Appointment cancelled successfully",
      });
    } catch (error: unknown) {
      console.error("cancelAppointment error:", error);

      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(error),
        },
        { status: 400 },
      );
    }
  }

  static async submitRating(request: NextRequest) {
    try {
      const body = (await request.json()) as SubmitRatingInput;

      await BookingService.submitRating(body);

      return NextResponse.json(
        {
          success: true,
          message: "Rating submitted successfully",
        },
        { status: 201 },
      );
    } catch (error: unknown) {
      console.error("submitRating error:", error);

      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(error),
        },
        { status: 400 },
      );
    }
  }
}