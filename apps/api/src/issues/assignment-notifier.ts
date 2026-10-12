import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_LOCALE, type UserRef } from "@sentinel/shared";
import type { ApiEnv } from "../config/env.js";
import { assignmentEmail } from "../mail/domain/assignment-email.js";
import { MailQueueService } from "../mail/mail-queue.service.js";
import { PreferencesRepository } from "../preferences/preferences.repository.js";
import { IssuesRepository } from "./issues.repository.js";

export interface AssignmentNotice {
	projectId: string;
	issueId: string;
	issueTitle: string;
	assignee: UserRef;
	assigner: { id: string; name: string };
}

/**
 * Avisa por correo a quien recibe un issue. No escribe a quien se lo asigna a sí mismo ni a quien
 * lo desactivó en sus preferencias, y nunca lanza: un correo que falla no debe deshacer la asignación.
 */
@Injectable()
export class AssignmentNotifier {
	private readonly logger = new Logger(AssignmentNotifier.name);
	private readonly webOrigin: string;

	constructor(
		private readonly mail: MailQueueService,
		private readonly preferences: PreferencesRepository,
		private readonly issues: IssuesRepository,
		config: ConfigService<ApiEnv, true>,
	) {
		this.webOrigin = config
			.get("WEB_ORIGIN", { infer: true })
			.replace(/\/$/, "");
	}

	async notify(notice: AssignmentNotice): Promise<void> {
		const { assignee, assigner } = notice;
		if (assignee.id === assigner.id) return;
		try {
			const prefs = await this.preferences.get(assignee.id);
			if (!prefs.emailOnAssign) return;
			const context = await this.issues.notificationContext(notice.projectId);
			if (!context) return;
			await this.mail.send({
				to: assignee.email,
				...assignmentEmail({
					assignerName: assigner.name,
					projectName: context.projectName,
					issueTitle: notice.issueTitle,
					url: `${this.webOrigin}/${context.orgSlug}/projects/${context.projectSlug}/issues/${notice.issueId}`,
					locale: prefs.locale ?? DEFAULT_LOCALE,
				}),
			});
		} catch (error) {
			this.logger.error(
				`no se pudo avisar de la asignación: ${(error as Error).message}`,
			);
		}
	}
}
