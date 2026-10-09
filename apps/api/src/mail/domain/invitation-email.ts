import { DEFAULT_LOCALE, type Locale, translate } from "@sentinel/shared";

export interface InvitationEmailInput {
	organizationName: string;
	inviterName: string;
	role: string | null | undefined;
	/** Enlace del panel para aceptar la invitación. */
	url: string;
	/** Idioma de quien la recibe. */
	locale?: Locale;
}

const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const clip = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max - 1)}…` : text;

const ROLES = {
	owner: "ROLE_OWNER",
	admin: "ROLE_ADMIN",
	member: "ROLE_MEMBER",
} as const;

/** Correo de invitación a una organización, en el idioma de quien la recibe. */
export function invitationEmail(input: InvitationEmailInput) {
	const locale = input.locale ?? DEFAULT_LOCALE;
	const organization = clip(input.organizationName, 80);
	const inviter = clip(input.inviterName, 80);
	const firstRole = input.role?.split(",")[0].trim() as
		| keyof typeof ROLES
		| undefined;
	const role = firstRole
		? translate(locale, "EMAIL_INVITE_AS_ROLE", {
				role: ROLES[firstRole]
					? translate(locale, ROLES[firstRole])
					: firstRole,
			})
		: "";
	const vars = { organization, inviter };
	const subject = translate(locale, "EMAIL_INVITE_SUBJECT", vars);
	const body = translate(locale, "EMAIL_INVITE_BODY", { ...vars, role });
	const hint = translate(locale, "EMAIL_INVITE_HINT");
	const accept = translate(locale, "EMAIL_INVITE_ACCEPT");

	const text = [body, "", `${accept}: ${input.url}`, "", hint].join("\n");
	// El cuerpo en HTML escapa los nombres (los controlan los usuarios) y resalta la organización.
	const htmlBody = escapeHtml(
		translate(locale, "EMAIL_INVITE_BODY", {
			...vars,
			role,
			organization: "\u0000",
		}),
	).replace("\u0000", `<strong>${escapeHtml(organization)}</strong>`);
	const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#2b2233">
<h2 style="margin:0 0 12px;font-size:18px;line-height:1.3">${escapeHtml(translate(locale, "EMAIL_INVITE_TITLE", vars))}</h2>
<p style="margin:0 0 20px;font-size:14px">${htmlBody}</p>
<p><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#6c5fc7;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px">${escapeHtml(accept)}</a></p>
<p style="font-size:12px;color:#8b8199">${escapeHtml(hint)}</p>
</div>`;
	return { subject, text, html };
}
