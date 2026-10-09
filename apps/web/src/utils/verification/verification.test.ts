import { describe, expect, it } from "vitest";
import {
	parseVerifiedSearch,
	parseVerifySearch,
	verificationCallbackUrl,
} from "./verification";

describe("verificationCallbackUrl", () => {
	it("lleva a la pantalla de correo verificado de este mismo origen", () => {
		expect(verificationCallbackUrl("https://app.example.com")).toBe(
			"https://app.example.com/email-verified",
		);
	});

	it("conserva el destino original, codificado", () => {
		expect(
			verificationCallbackUrl(
				"https://app.example.com",
				"/accept-invitation/abc?x=1",
			),
		).toBe(
			"https://app.example.com/email-verified?redirect=%2Faccept-invitation%2Fabc%3Fx%3D1",
		);
	});

	it("descarta un destino que no sea una ruta interna", () => {
		expect(
			verificationCallbackUrl(
				"https://app.example.com",
				"https://evil.example.com",
			),
		).toBe("https://app.example.com/email-verified");
		expect(
			verificationCallbackUrl("https://app.example.com", "//evil.example.com"),
		).toBe("https://app.example.com/email-verified");
	});
});

describe("parseVerifySearch", () => {
	it("acepta una dirección y un destino interno", () => {
		expect(
			parseVerifySearch({ email: "a@b.co", redirect: "/accept-invitation/x" }),
		).toEqual({
			email: "a@b.co",
			redirect: "/accept-invitation/x",
		});
	});

	it("descarta lo que no es seguro o no es texto", () => {
		expect(
			parseVerifySearch({ email: 5, redirect: "https://evil.example.com" }),
		).toEqual({});
		expect(parseVerifySearch({ email: "x".repeat(300) })).toEqual({});
		expect(parseVerifySearch({})).toEqual({});
	});
});

describe("parseVerifiedSearch", () => {
	it("acepta los códigos de error del servidor", () => {
		expect(parseVerifiedSearch({ error: "token_expired" })).toEqual({
			error: "token_expired",
		});
		expect(
			parseVerifiedSearch({ error: "invalid_token", redirect: "/x" }),
		).toEqual({ error: "invalid_token", redirect: "/x" });
	});

	it("rechaza texto libre, mayúsculas, símbolos o algo demasiado largo", () => {
		for (const error of [
			"<script>",
			"Token Expired",
			"a-b",
			"x".repeat(41),
			"",
			3,
		]) {
			expect(parseVerifiedSearch({ error }), String(error)).toEqual({});
		}
	});

	it("descarta un destino externo", () => {
		expect(parseVerifiedSearch({ redirect: "//evil.example.com" })).toEqual({});
	});
});
