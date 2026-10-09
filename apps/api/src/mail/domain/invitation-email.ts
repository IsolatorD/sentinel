export interface InvitationEmailInput {
	organizationName: string;
	inviterName: string;
	role: string | null | undefined;
	/** Enlace del panel para aceptar la invitación. */
	url: string;
}

const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const clip = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Correo de invitación a una organización. Nombres e idioma: el de quien invita, no el del destinatario. */
export function invitationEmail(input: InvitationEmailInput) {
	const organization = clip(input.organizationName, 80);
	const inviter = clip(input.inviterName, 80);
	const role = input.role ? ` as ${input.role.split(",")[0].trim()}` : "";
	const subject = `${inviter} invited you to ${organization} on Sentinel`;
	const text = [
		`${inviter} invited you to join ${organization}${role} on Sentinel.`,
		"",
		`Accept the invitation: ${input.url}`,
		"",
		"If you do not have an account yet, create one with this email address and then open the link again. If you were not expecting this invitation, you can ignore this email.",
	].join("\n");
	const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#2b2233">
<h2 style="margin:0 0 12px;font-size:18px;line-height:1.3">You have been invited to ${escapeHtml(organization)}</h2>
<p style="margin:0 0 20px;font-size:14px">${escapeHtml(inviter)} invited you to join <strong>${escapeHtml(organization)}</strong>${escapeHtml(role)} on Sentinel.</p>
<p><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#6c5fc7;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px">Accept the invitation</a></p>
<p style="font-size:12px;color:#8b8199">If you do not have an account yet, create one with this email address and then open the link again. If you were not expecting this invitation, you can ignore this email.</p>
</div>`;
	return { subject, text, html };
}
