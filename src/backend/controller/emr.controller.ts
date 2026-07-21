import { NextRequest } from "next/server";
import { EMRService } from "../service/emr.service";
import { getAuthUser } from "@/shared/auth/get-auth-user";
import { apiSuccess } from "@/shared/api/api-response";

export class EMRController {
  static async getHealthRecords(req: NextRequest) {
    const authUser = await getAuthUser(req);
    const records = await EMRService.getHealthRecords(authUser);
    return apiSuccess(records);
  }

  static async handlePost(req: NextRequest) {
    const authUser = await getAuthUser(req);
    const body = await req.json();

    const { action, payload } = body;

    switch (action) {
      case "savePatientVitals":
        await EMRService.savePatientVitals(authUser, payload.vitals);
        break;
      case "addPatientProblem":
        await EMRService.addPatientProblem(authUser, payload.problem);
        break;
      case "removePatientProblem":
        await EMRService.removePatientProblem(authUser, payload.code);
        break;
      case "savePatientNote":
        await EMRService.savePatientNote(authUser, payload.noteText);
        break;
      default:
        throw new Error("Invalid action");
    }

    return apiSuccess({ success: true });
  }
}
