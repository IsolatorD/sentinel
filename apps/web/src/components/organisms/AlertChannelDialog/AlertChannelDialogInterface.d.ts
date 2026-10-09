import type { CreatedChannelDto } from "@sentinel/shared";
import type { ReadyScope } from "@/hooks/useAlerts/useAlertsInterface";

export interface AlertChannelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	scope: ReadyScope;
	/** Se llama con el canal creado (si es un webhook trae su secreto de firma). */
	onCreated: (channel: CreatedChannelDto) => void;
}

export interface ChannelFormErrors {
	name?: string;
	url?: string;
	recipients?: string;
}
