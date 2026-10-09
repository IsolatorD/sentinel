import { describe, expect, it } from "vitest";
import { issueUpdatedNotice } from "./notices.js";

const notice = (body: unknown, result: unknown = {}) =>
	issueUpdatedNotice({ request: { body } as never, result });

describe("issueUpdatedNotice", () => {
	it("avisa según el nuevo estado", () => {
		expect(notice({ status: "ignored" })).toEqual({
			code: "NOTICE_ISSUE_IGNORED",
		});
		expect(notice({ status: "unresolved" })).toEqual({
			code: "NOTICE_ISSUE_REOPENED",
		});
		expect(notice({ status: "resolved" })).toEqual({
			code: "NOTICE_ISSUE_RESOLVED",
		});
	});

	it("al resolver distingue 'en la release X' de 'en la próxima'", () => {
		expect(
			notice({
				status: "resolved",
				resolution: { type: "release", release: "2.5.0" },
			}),
		).toEqual({
			code: "NOTICE_ISSUE_RESOLVED_IN",
			params: { release: "2.5.0" },
		});
		expect(
			notice({ status: "resolved", resolution: { type: "next_release" } }),
		).toEqual({
			code: "NOTICE_ISSUE_RESOLVED_NEXT",
		});
	});

	it("asignar dice a quién, y desasignar lo dice", () => {
		expect(notice({ assigneeId: "u1" }, { assignee: { name: "Ana" } })).toEqual(
			{
				code: "NOTICE_ISSUE_ASSIGNED",
				params: { name: "Ana" },
			},
		);
		expect(notice({ assigneeId: null }, { assignee: null })).toEqual({
			code: "NOTICE_ISSUE_UNASSIGNED",
		});
	});

	it("si cambia estado y responsable a la vez, manda el estado", () => {
		expect(
			notice(
				{ status: "resolved", assigneeId: "u1" },
				{ assignee: { name: "Ana" } },
			),
		).toEqual({
			code: "NOTICE_ISSUE_RESOLVED",
		});
	});

	it("una petición sin nada reconocible no avisa", () => {
		expect(notice({})).toBeUndefined();
		expect(notice(undefined)).toBeUndefined();
	});
});
