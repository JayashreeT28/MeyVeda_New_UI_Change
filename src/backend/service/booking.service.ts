import { BookingRepository, type BookAppointmentInput, type SubmitRatingInput, type AppointmentRow } from "../repo/booking.repo";

export class BookingService {
  static async getAppointments(
    patientId: string,
  ): Promise<AppointmentRow[]> {
    if (!patientId?.trim()) {
      throw new Error("Patient ID is required");
    }

    return BookingRepository.getAppointments(patientId);
  }

  static async bookAppointment(
    input: BookAppointmentInput,
  ): Promise<void> {
    if (!input.userId) {
      throw new Error("User ID is required");
    }

    if (!input.slotId) {
      throw new Error("Slot ID is required");
    }

    if (!input.practitionerId) {
      throw new Error("Practitioner ID is required");
    }

    if (!input.date || !input.time) {
      throw new Error("Appointment date and time are required");
    }

    await BookingRepository.bookAppointment(input);
  }

  static async cancelAppointment(
    appointmentId: string,
    reason: string,
  ): Promise<void> {
    if (!appointmentId) {
      throw new Error("Appointment ID is required");
    }

    if (!reason?.trim()) {
      throw new Error("Cancellation reason is required");
    }

    await BookingRepository.cancelAppointment(
      appointmentId,
      reason.trim(),
    );
  }

  static async submitRating(
    input: SubmitRatingInput,
  ): Promise<void> {
    if (input.stars < 1 || input.stars > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    await BookingRepository.submitRating(input);
  }
}