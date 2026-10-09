import {
	BadRequestException,
	ForbiddenException,
	HttpException,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { codeForStatus, toErrorResponse } from "./error-response.js";
import { ZodValidationException } from "./zod-validation.pipe.js";

describe("toErrorResponse", () => {
	it("mapea excepciones con su código genérico y su razón específica", () => {
		const r = toErrorResponse(
			new NotFoundException({ reason: "PROJECT_NOT_FOUND" }),
		);
		expect(r).toMatchObject({
			status: 404,
			unexpected: false,
			body: {
				statusCode: 404,
				code: "NOT_FOUND",
				reason: "PROJECT_NOT_FOUND",
				message: "Project not found",
			},
		});
		expect(toErrorResponse(new ForbiddenException()).body).toMatchObject({
			code: "FORBIDDEN",
			reason: "FORBIDDEN",
			message: "Forbidden",
		});
	});

	it("traduce el mensaje al idioma de la petición, con sus valores", () => {
		const es = toErrorResponse(
			new NotFoundException({ reason: "ISSUE_NOT_FOUND" }),
			"es",
		);
		expect(es.body.message).toBe("No se encontró el issue");
		expect(es.body.reason).toBe("ISSUE_NOT_FOUND"); // el código no cambia con el idioma
		expect(es.body.code).toBe("NOT_FOUND");

		const withParams = toErrorResponse(
			new BadRequestException({
				reason: "NOTICE_ISSUE_ASSIGNED",
				params: { name: "Ana" },
			}),
			"es",
		);
		expect(withParams.body.message).toBe("Issue asignado a Ana");
	});

	it("traduce los mensajes por defecto de Nest, pero respeta uno propio", () => {
		expect(
			toErrorResponse(new UnauthorizedException(), "es").body.message,
		).toBe("No autorizado");
		expect(toErrorResponse(new NotFoundException(), "es").body.message).toBe(
			"No encontrado",
		);
		const custom = toErrorResponse(
			new NotFoundException("Algo muy concreto"),
			"es",
		);
		expect(custom.body.message).toBe("Algo muy concreto");
		expect(custom.body.reason).toBeUndefined();
	});

	it("un código de razón inventado no se usa", () => {
		const r = toErrorResponse(new BadRequestException({ reason: "NO_EXISTE" }));
		expect(r.body.reason).toBeUndefined();
	});

	it("los errores de validación se redactan en el idioma de la petición", () => {
		const schema = z.object({ name: z.string().min(3) });
		const exception = new ZodValidationException(schema, { name: "a" });
		const en = toErrorResponse(exception, "en");
		expect(en.status).toBe(400);
		expect(en.body).toMatchObject({
			code: "VALIDATION_FAILED",
			reason: "VALIDATION_FAILED",
			message: "Validation failed",
		});
		expect(en.body.issues?.[0]).toMatchObject({
			path: "name",
			message: expect.stringContaining("Too small"),
		});

		const es = toErrorResponse(exception, "es");
		expect(es.body.message).toBe("La validación falló");
		expect(es.body.issues?.[0].message).toMatch(/Demasiado pequeño/);
	});

	it("los mensajes propios de un esquema son códigos del catálogo y se traducen", () => {
		const schema = z
			.object({})
			.refine(() => false, { message: "NOTHING_TO_UPDATE" });
		const exception = new ZodValidationException(schema, {});
		expect(toErrorResponse(exception, "en").body.issues?.[0].message).toBe(
			"Nothing to update",
		);
		expect(toErrorResponse(exception, "es").body.issues?.[0].message).toBe(
			"No hay nada que actualizar",
		);
	});

	it("el tipo recibido se redacta bien en español (usa el valor original)", () => {
		const exception = new ZodValidationException(z.object({ n: z.string() }), {
			n: 5,
		});
		expect(toErrorResponse(exception, "es").body.issues?.[0].message).toMatch(
			/se esperaba texto, recibido número/,
		);
	});

	it("conserva los issues que ya vengan formados (formato antiguo)", () => {
		const issues = [{ path: "name", message: "Too small" }];
		const r = toErrorResponse(
			new BadRequestException({ message: "Validation failed", issues }),
		);
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

	it("respeta el statusCode 4xx de errores de Fastify, con un mensaje genérico traducido", () => {
		const err = Object.assign(new Error("Request body is too large"), {
			statusCode: 413,
		});
		expect(toErrorResponse(err)).toMatchObject({
			status: 413,
			unexpected: false,
			body: {
				code: "PAYLOAD_TOO_LARGE",
				reason: "PAYLOAD_TOO_LARGE",
				message: "The request is too large",
			},
		});
		expect(toErrorResponse(err, "es").body.message).toBe(
			"La petición es demasiado grande",
		);
	});

	it("oculta el detalle de errores inesperados y los marca para registrar", () => {
		const r = toErrorResponse(
			new Error("password=secret in connection string"),
			"es",
		);
		expect(r).toEqual({
			status: 500,
			unexpected: true,
			body: {
				statusCode: 500,
				code: "INTERNAL_ERROR",
				reason: "INTERNAL_ERROR",
				message: "Error interno del servidor",
			},
		});
	});

	it("un HttpException 5xx también es inesperado y no filtra su mensaje", () => {
		const r = toErrorResponse(new HttpException("boom", 503));
		expect(r.unexpected).toBe(true);
		expect(r.body.message).toBe("Internal server error");
	});
});

describe("codeForStatus", () => {
	it("tiene códigos para los estados usados y un genérico para el resto", () => {
		expect(codeForStatus(429)).toBe("TOO_MANY_REQUESTS");
		expect(codeForStatus(418)).toBe("HTTP_418");
		expect(codeForStatus(502)).toBe("INTERNAL_ERROR");
	});
});
