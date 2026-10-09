import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WorkerEnv } from "../../config/env.js";
import { classifyHttpStatus, DeliveryError } from "../domain/delivery-error.js";
import { guardedFetch } from "../domain/guarded-fetch.js";
import { slackBody } from "../domain/messages.js";
import { Notifier, type NotifyInput } from "./notifier.js";

@Injectable()
export class SlackNotifier extends Notifier {
	readonly type = "slack";
	private readonly allowPrivate: boolean;

	constructor(config: ConfigService<WorkerEnv, true>) {
		super();
		this.allowPrivate = config.get("ALLOW_PRIVATE_WEBHOOKS", { infer: true });
	}

	async send({ channel, payload }: NotifyInput) {
		const { url } = channel.config as { url?: string };
		if (!url)
			throw new DeliveryError("The channel is missing its URL", {
				permanent: true,
			});

		const { status } = await guardedFetch(url, {
			method: "POST",
			allowPrivate: this.allowPrivate,
			body: JSON.stringify(slackBody(payload)),
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "Sentinel-Webhooks/1.0",
			},
		});
		const outcome = classifyHttpStatus(status);
		if (outcome === "ok") return { statusCode: status };
		throw new DeliveryError(`Slack answered HTTP ${status}`, {
			permanent: outcome === "permanent",
			statusCode: status,
		});
	}
}
