import type { AlertPayload } from "@sentinel/shared";
import type { ChannelRecord } from "../alerts.repository.js";

export interface NotifyInput {
	channel: ChannelRecord;
	payload: AlertPayload;
	deliveryId: string;
	organizationId: string;
}

/** Un tipo de canal. Para integrar otra herramienta (Jira, Teams...) se añade un notificador. */
export abstract class Notifier {
	abstract readonly type: string;
	abstract send(input: NotifyInput): Promise<{ statusCode?: number }>;
}
