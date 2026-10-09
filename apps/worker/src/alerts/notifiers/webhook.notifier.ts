import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WorkerEnv } from "../../config/env.js";
import { classifyHttpStatus, DeliveryError } from "../domain/delivery-error.js";
import { guardedFetch } from "../domain/guarded-fetch.js";
import { signWebhook, webhookBody } from "../domain/messages.js";
import { Notifier, type NotifyInput } from "./notifier.js";

@Injectable()
export class WebhookNotifier extends Notifier {
	readonly type = "webhook";
	private readonly allowPrivate: boolean;

	constructor(config: ConfigService<WorkerEnv, true>) {
		super();
		this.allowPrivate = config.get("ALLOW_PRIVATE_WEBHOOKS", { infer: true });
	}

	async send({ channel, payload, deliveryId }: NotifyInput) {
		const { url, secret } = channel.config as { url?: string; secret?: string };
		if (!url || !secret)
			throw new DeliveryError("The channel is missing its URL or secret", {
				permanent: true,
			});

		const now = new Date();
		const timestamp = Math.floor(now.getTime() / 1000);
		const body = JSON.stringify(webhookBody(payload, deliveryId, now));
		const { status } = await guardedFetch(url, {
			method: "POST",
			allowPrivate: this.allowPrivate,
			body,
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "Sentinel-Webhooks/1.0",
				"X-Sentinel-Event": webhookBody(payload, deliveryId, now).event,
				"X-Sentinel-Delivery": deliveryId,
				"X-Sentinel-Timestamp": String(timestamp),
				"X-Sentinel-Signature": signWebhook(secret, timestamp, body),
			},
		});
		const outcome = classifyHttpStatus(status);
		if (outcome === "ok") return { statusCode: status };
		throw new DeliveryError(`The endpoint answered HTTP ${status}`, {
			permanent: outcome === "permanent",
			statusCode: status,
		});
	}
}
