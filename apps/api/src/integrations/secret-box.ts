import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "node:crypto";

const VERSION = "v1";

/**
 * Cifra secretos de integraciones (API tokens) antes de guardarlos en la base de datos, con AES-256-GCM.
 * La clave se deriva del secreto del servidor: si ese secreto cambia, los tokens guardados dejan de poder
 * leerse y hay que volver a conectar la integración.
 */
export class SecretBox {
	private readonly key: Buffer;

	constructor(secret: string) {
		this.key = Buffer.from(
			hkdfSync("sha256", secret, "sentinel", "integrations-v1", 32),
		);
	}

	encrypt(plain: string): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", this.key, iv);
		const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
		return [VERSION, iv, cipher.getAuthTag(), body]
			.map((part) =>
				typeof part === "string" ? part : part.toString("base64"),
			)
			.join(".");
	}

	/** Lanza si el texto está alterado o se cifró con otra clave. */
	decrypt(token: string): string {
		const [version, iv, tag, body] = token.split(".");
		if (version !== VERSION || !iv || !tag || body === undefined)
			throw new Error("Unsupported secret format");
		const decipher = createDecipheriv(
			"aes-256-gcm",
			this.key,
			Buffer.from(iv, "base64"),
		);
		decipher.setAuthTag(Buffer.from(tag, "base64"));
		return Buffer.concat([
			decipher.update(Buffer.from(body, "base64")),
			decipher.final(),
		]).toString("utf8");
	}
}
