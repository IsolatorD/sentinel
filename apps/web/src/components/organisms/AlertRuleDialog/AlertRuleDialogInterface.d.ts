import type { ChannelDto, RuleDto } from "@sentinel/shared";
import type { ReadyScope } from "@/hooks/useAlerts/useAlertsInterface";

export interface AlertRuleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	scope: ReadyScope;
	channels: ChannelDto[];
	/** Regla a editar; sin ella el diálogo crea una nueva. */
	rule?: RuleDto;
}

export interface RuleFormErrors {
	name?: string;
	threshold?: string;
	transactionName?: string;
	channels?: string;
}
