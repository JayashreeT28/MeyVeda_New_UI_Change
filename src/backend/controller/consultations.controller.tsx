/**
 * Consultations controller — handles PDF generation.
 */
import { NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { ConsultationPdfDocument } from "@/components/consultation-report/ConsultationPdfDocument";
import { ConsultationService } from "../service/consultation.service";
import { requireAuth } from "@/shared/auth/require-auth";
import { AppError } from "@/shared/api/api-error";

/**
 * GET /api/consultations/[id]/pdf — Generate consultation PDF.
 */
export async function generatePdf(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Authenticate and fetch consultation data (ownership-checked)
  let data: any;
  try {
    const authUser = await requireAuth(req);
    data = await ConsultationService.getConsultationReportData(authUser, id);
  } catch (error: unknown) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Failed to load consultation";
    return new Response(message, { status: statusCode });
  }

  // 2. Render PDF to Node stream
  const pdfStream = await renderToStream(<ConsultationPdfDocument data={data} />);

  // 3. Convert Node stream to Web ReadableStream for Next.js App Router Response
  const webStream = new ReadableStream({
    start(controller) {
      pdfStream.on("data", (chunk) => controller.enqueue(chunk));
      pdfStream.on("end", () => controller.close());
      pdfStream.on("error", (err) => controller.error(err));
    },
  });

  // 4. Construct safe filename
  const patientName =
    (data.patients as any)?.full_name?.replace(/[^a-zA-Z0-9]/g, "_") || "Patient";
  const dateStr = data.created_at
    ? new Date(data.created_at).toISOString().split("T")[0]
    : "Date";
  const filename = `MeyVeda_Consultation_${patientName}_${dateStr}.pdf`;

  // 5. Return PDF
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
