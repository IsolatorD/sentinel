import {
	BadRequestException,
	ForbiddenException,
	HttpException,
	NotFoundException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { codeForStatus, toErrorResponse } from "./error-response.js";

describe("toErrorResponse", () => {
	it("mapea excepciones HTTP con su código", () => {
		const r = toErrorResponse(new NotFoundException("Project not found"));
		expect(r).toMatchObject({
			status: 404,
			unexpected: false,
			body: {
				statusCode: 404,
				code: "NOT_FOUND",
				message: "Project not found",
			},
		});
		expect(toErrorResponse(new ForbiddenException()).body.code).toBe(
			"FORBIDDEN",
		);
	});

	it("incluye los issues de validación y usa VALIDATION_FAILED", () => {
		const issues = [{ path: "name", message: "Too small" }];
		const r = toErrorResponse(
			new BadRequestException({ message: "Validation failed", issues }),
		);
		expect(r.status).toBe(400);
		expect(r.body).toEqual({
			statusCode: 400,
			code: "VALIDATION_FAILED",
			message: "Validation failed",
			issues,
		});
	});

	it("une los mensajes cuando vienen como lista", () => {
		const r = toErrorResponse(new BadRequestException(["a", "b"]));
		expect(r.body.message).toBe("a, b");
	});

	it("respeta el statusCode 4xx de errores de Fastify", () => {
		const err = Object.assign(new Error("Request body is too large"), {
			statusCode: 413,
		});
		expect(toErrorResponse(err)).toMatchObject({
			status: 413,
			unexpected: false,
			body: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" },
		});
	});

	it("oculta el detalle de errores inesperados y los marca para registrar", () => {
		const r = toErrorResponse(
			new Error("password=secret in connection string"),
		);
		expect(r).toEqual({
			status: 500,
			unexpected: true,
			body: {
				statusCode: 500,
				code: "INTERNAL_ERROR",
				message: "Internal server error",
			},
		});
	});

	it("un HttpException 5xx también es inesperado", () => {
		expect(toErrorResponse(new HttpException("boom", 503)).unexpected).toBe(
			true,
		);
	});
});

describe("codeForStatus", () => {
	it("tiene códigos para los estados usados y un genérico para el resto", () => {
		expect(codeForStatus(429)).toBe("TOO_MANY_REQUESTS");
		expect(codeForStatus(418)).toBe("HTTP_418");
		expect(codeForStatus(502)).toBe("INTERNAL_ERROR");
	});
});
