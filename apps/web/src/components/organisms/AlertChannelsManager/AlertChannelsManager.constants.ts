import { Mail, MessageSquare, Webhook } from "lucide-react";

export const TYPE_ICONS = {
	email: Mail,
	webhook: Webhook,
	slack: MessageSquare,
} as const;
