import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant } from "../support/factories.js";

// El SDK de Python real (un proceso aparte) enviando a la API real, procesado por el worker real.
const sdkDir = fileURLToPath(
	new URL("../../../packages/sdk-python/", import.meta.url),
);
const python = `${sdkDir}.venv/bin/python`;
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT = "00f067aa0ba902b7";

const SCRIPT = `
import sys
import sentinel_sdk

sentinel_sdk.init(sys.argv[1], release="7.7.7", environment="e2e", traces_sample_rate=1.0, capture_global_errors=False)

def charge_card():
    raise RuntimeError("card declined")

try:
    charge_card()
except Exception:
    sentinel_sdk.capture_exception()

client = sentinel_sdk.get_client()
with client.start_transaction("POST /orders", "http.server", trace_id="${TRACE}", parent_span_id="${PARENT}"):
    with sentinel_sdk.start_span("db.query", "insert into orders"):
        pass
    sentinel_sdk.capture_message("order failed")

assert sentinel_sdk.flush(10)
`;

describe.skipIf(!existsSync(python))("SDK de Python contra la API real", () => {
	it("un error y una transacción de Python llegan, se procesan y quedan enlazados", async () => {
		const t = await createTenant();
		await promisify(execFile)(python, ["-c", SCRIPT, t.dsn], {
			cwd: sdkDir,
			timeout: 30_000,
		});

		await eventually(async () => {
			expect(
				await scalar("select count(*) from event where project_id = $1", [
					t.projectId,
				]),
			).toBe(2);
			expect(
				await scalar(
					"select count(*) from perf_transaction where project_id = $1",
					[t.projectId],
				),
			).toBe(1);
		});

		// El error: plataforma python, con su stack y el código propio marcado.
		const issues = (
			await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
		).json.items as Array<{
			type: string;
			title: string;
			culprit: string | null;
		}>;
		const error = issues.find((i) => i.type === "RuntimeError");
		expect(error?.title).toBe("RuntimeError: card declined");
		expect(error?.culprit).toContain("charge_card");
		expect(
			await scalar(
				"select count(*) from event where project_id = $1 and platform = 'python' and release = '7.7.7'",
				[t.projectId],
			),
		).toBe(2);

		// La transacción continúa la traza que le llegó, con su span.
		expect(
			await scalar(
				"select count(*) from perf_transaction where project_id = $1 and platform = 'python' and name = 'POST /orders' and trace_id = $2 and parent_span_id = $3",
				[t.projectId, TRACE, PARENT],
			),
		).toBe(1);
		expect(
			await scalar(
				"select count(*) from perf_span s join perf_transaction x on x.id = s.transaction_id where x.project_id = $1 and s.description = 'insert into orders'",
				[t.projectId],
			),
		).toBe(1);

		// El mensaje capturado dentro de la transacción quedó enlazado a su traza.
		const trace = (
			await t.client.get(
				`${t.projectPath}/performance/traces/${TRACE}`,
				t.owner,
			)
		).json;
		expect(trace.transactions).toHaveLength(1);
		expect(
			trace.events.map((e: { issueTitle: string }) => e.issueTitle),
		).toEqual(["order failed"]);
	});
});
