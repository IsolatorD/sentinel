import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Database } from "@sentinel/db";
import type { ApiEnv } from "../config/env.js";
import { DB } from "../database/database.module.js";
import { invitationEmail } from "../mail/domain/invitation-email.js";
import { MailModule } from "../mail/mail.module.js";
import { MailQueueService } from "../mail/mail-queue.service.js";
import { AUTH } from "./auth.constants.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { createAuth } from "./auth.js";
import { localeForInvitee } from "./locale-lookup.js";

@Module({
	imports: [MailModule],
	controllers: [AuthController],
	providers: [
		AuthGuard,
		{
			provide: AUTH,
			inject: [DB, ConfigService, MailQueueService],
			useFactory: (
				db: Database,
				config: ConfigService<ApiEnv, true>,
				mail: MailQueueService,
			) => {
				const clientId = config.get("GOOGLE_CLIENT_ID", { infer: true });
				const clientSecret = config.get("GOOGLE_CLIENT_SECRET", {
					infer: true,
				});
				const webOrigin = config
					.get("WEB_ORIGIN", { infer: true })
					.replace(/\/$/, "");
				return createAuth({
					db,
					sendInvitation: async (invite) =>
						mail.send({
							to: invite.email,
							...invitationEmail({
								organizationName: invite.organizationName,
								inviterName: invite.inviterName,
								role: invite.role,
								url: `${webOrigin}/accept-invitation/${invite.invitationId}`,
								locale: await localeForInvitee(db, {
									email: invite.email,
									inviterId: invite.inviterId,
									acceptLanguage: invite.acceptLanguage,
								}),
							}),
						}),
					secret: config.get("BETTER_AUTH_SECRET", { infer: true }),
					baseURL: config.get("BETTER_AUTH_URL", { infer: true }),
					webOrigin: config.get("WEB_ORIGIN", { infer: true }),
					google:
						clientId && clientSecret ? { clientId, clientSecret } : undefined,
				});
			},
		},
	],
	exports: [AUTH, AuthGuard],
})
export class AuthModule {}
