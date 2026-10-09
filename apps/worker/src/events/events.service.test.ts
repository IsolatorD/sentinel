import type { IngestJobData } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import type { EventRepository, NewEvent } from "./event.repository.js";
import { EventsService } from "./events.service.js";
import type { SymbolicatorService } from "./symbolicator.service.js";

function setup() {
	const saved: NewEvent[] = [];
	const repo: EventRepository = {
		async save(event) {
			saved.push(event);
			return { eventId: event.id, isNewIssue: true, duplicate: false };
		},
	};
	return {
		service: new EventsService(repo, {
			symbolicate: async (_p: string, e: unknown) => e,
		} as unknown as SymbolicatorService),
		saved,
	};
}

const job = (
	over: Partial<IngestJobData["event"]> = {},
	client = {},
): IngestJobData => ({
	projectId: "proj-1",
	eventId: "evt-1",
	receivedAt: "2026-10-09T12:00:00.000Z",
	client,
	event: {
		level: "error",
		exception: {
			values: [
				{
					type: "TypeError",
					value: "x is undefined",
					stacktrace: {
						frames: [
							{
								filename: "Cart.js",
								function: "total",
								lineno: 3,
								in_app: true,
							},
						],
					},
				},
			],
		},
		...over,
	},
});

describe("EventsService.store", () => {
	it("analiza el evento y lo entrega al repositorio", async () => {
		const { service, saved } = setup();
		const result = await service.store(
			job({ release: "1.0.0", environment: "prod" }),
		);

		expect(result.isNewIssue).toBe(true);
		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject({
			id: "evt-1",
			projectId: "proj-1",
			level: "error",
			release: "1.0.0",
			environment: "prod",
			message: "x is undefined",
			analysis: { type: "TypeError", title: "TypeError: x is undefined" },
		});
		expect(saved[0].analysis.fingerprint).toMatch(/^[0-9a-f]{32}$/);
	});

	it("usa la hora de recepción si el evento no trae timestamp", async () => {
		const { service, saved } = setup();
		await service.store(job());
		expect(saved[0].timestamp.toISOString()).toBe("2026-10-09T12:00:00.000Z");
	});

	it("identifica al usuario por id, email, username, ip del evento o ip del cliente", async () => {
		const cases: Array<
			[Partial<IngestJobData["event"]>, object, string | undefined]
		> = [
			[{ user: { id: "u1", email: "a@b.c" } }, {}, "u1"],
			[{ user: { email: "a@b.c", username: "ana" } }, {}, "a@b.c"],
			[{ user: { username: "ana" } }, {}, "ana"],
			[{ user: { ip_address: "1.1.1.1" } }, { ip: "2.2.2.2" }, "1.1.1.1"],
			[{}, { ip: "2.2.2.2" }, "2.2.2.2"],
			[{}, {}, undefined],
		];
		for (const [event, client, expected] of cases) {
			const { service, saved } = setup();
			await service.store(job(event, client));
			expect(saved[0].userIdentifier).toBe(expected);
		}
	});

	it("guarda el payload completo junto con los datos del cliente", async () => {
		const { service, saved } = setup();
		await service.store(
			job({ tags: { feature: "cart" } }, { ip: "9.9.9.9", userAgent: "UA" }),
		);
		expect(saved[0].payload).toMatchObject({
			tags: { feature: "cart" },
			_client: { ip: "9.9.9.9", userAgent: "UA" },
		});
	});

	it("para mensajes sin excepción, el texto del mensaje queda en `message`", async () => {
		const { service, saved } = setup();
		await service.store(
			job({ exception: undefined, message: "Checkout done" }),
		);
		expect(saved[0].message).toBe("Checkout done");
		expect(saved[0].analysis.type).toBe("message");
	});
});
