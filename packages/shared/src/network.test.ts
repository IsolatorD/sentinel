import { describe, expect, it } from "vitest";
import {
	checkWebhookUrl,
	isBlockedHostname,
	isPrivateAddress,
} from "./network.js";

describe("isPrivateAddress", () => {
	it("bloquea los rangos privados, de loopback y de metadatos de IPv4", () => {
		for (const ip of [
			"0.0.0.0",
			"10.1.2.3",
			"127.0.0.1",
			"127.255.255.254",
			"100.64.0.1",
			"169.254.169.254",
			"172.16.0.1",
			"172.31.255.255",
			"192.168.1.1",
			"198.18.0.1",
			"224.0.0.1",
			"255.255.255.255",
		]) {
			expect(isPrivateAddress(ip), ip).toBe(true);
		}
	});

	it("permite direcciones públicas, incluidos los límites de los rangos privados", () => {
		for (const ip of [
			"8.8.8.8",
			"1.1.1.1",
			"172.15.0.1",
			"172.32.0.1",
			"100.63.0.1",
			"100.128.0.1",
			"192.169.0.1",
			"93.184.216.34",
		]) {
			expect(isPrivateAddress(ip), ip).toBe(false);
		}
	});

	it("bloquea IPv6 de loopback, locales y link-local, y evalúa las IPv4 mapeadas", () => {
		for (const ip of [
			"::1",
			"::",
			"fe80::1",
			"fc00::1",
			"fd12:3456::1",
			"ff02::1",
			"::ffff:127.0.0.1",
			"::ffff:10.0.0.1",
			"::ffff:7f00:1",
			"[::1]",
			"fe80::1%eth0",
		]) {
			expect(isPrivateAddress(ip), ip).toBe(true);
		}
		for (const ip of [
			"2606:4700:4700::1111",
			"2001:4860:4860::8888",
			"::ffff:8.8.8.8",
		]) {
			expect(isPrivateAddress(ip), ip).toBe(false);
		}
	});

	it("ante una dirección que no se puede interpretar, bloquea", () => {
		for (const ip of [
			"",
			"abc",
			"1.2.3",
			"1.2.3.4.5",
			"256.1.1.1",
			"1::2::3",
			"gggg::1",
		]) {
			expect(isPrivateAddress(ip), ip).toBe(true);
		}
	});
});

describe("isBlockedHostname", () => {
	it("bloquea nombres internos y direcciones privadas escritas como host", () => {
		for (const host of [
			"localhost",
			"LOCALHOST",
			"api.localhost",
			"printer.local",
			"db.internal",
			"metadata.google.internal",
			"127.0.0.1",
			"[::1]",
			"10.0.0.5",
			"localhost.",
		]) {
			expect(isBlockedHostname(host), host).toBe(true);
		}
	});

	it("permite nombres públicos", () => {
		for (const host of [
			"hooks.slack.com",
			"example.com",
			"8.8.8.8",
			"my-localhost-app.com",
		]) {
			expect(isBlockedHostname(host), host).toBe(false);
		}
	});
});

describe("checkWebhookUrl", () => {
	it("acepta http y https públicos", () => {
		expect(checkWebhookUrl("https://hooks.slack.com/services/T/B/x").ok).toBe(
			true,
		);
		expect(checkWebhookUrl("http://example.com/hook").ok).toBe(true);
	});

	it("rechaza URLs mal formadas, otros esquemas, credenciales y hosts internos", () => {
		for (const url of [
			"no es url",
			"ftp://example.com",
			"file:///etc/passwd",
			"javascript:alert(1)",
			"https://user:pass@example.com",
			"http://localhost:3000/x",
			"http://127.0.0.1/x",
			"http://169.254.169.254/latest/meta-data",
			"http://[::1]/x",
			"http://2130706433/",
			"http://0x7f.0.0.1/",
		]) {
			const check = checkWebhookUrl(url);
			expect(check.ok, url).toBe(false);
		}
	});

	it("con allowPrivate (desarrollo y pruebas) deja pasar hosts locales pero sigue exigiendo http(s)", () => {
		expect(
			checkWebhookUrl("http://127.0.0.1:4000/hook", { allowPrivate: true }).ok,
		).toBe(true);
		expect(checkWebhookUrl("ftp://127.0.0.1", { allowPrivate: true }).ok).toBe(
			false,
		);
	});
});
