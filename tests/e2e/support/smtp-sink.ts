import { appendFileSync, writeFileSync } from "node:fs";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";

export interface SinkMail {
	to: string[];
	from: string;
	subject: string;
	text: string;
	html: string;
}

/** Servidor SMTP de pruebas: acepta todo y anota cada correo en un archivo (una línea JSON por correo). */
export async function startSmtpSink(
	port: number,
	file: string,
): Promise<() => Promise<void>> {
	writeFileSync(file, "");
	const server = new SMTPServer({
		authOptional: true,
		disabledCommands: ["STARTTLS", "AUTH"],
		onData(stream, _session, callback) {
			simpleParser(stream)
				.then((mail) => {
					const to = [mail.to]
						.flat()
						.flatMap((a) => a?.value ?? [])
						.map((a) => a.address ?? "");
					const entry: SinkMail = {
						to,
						from: mail.from?.text ?? "",
						subject: mail.subject ?? "",
						text: mail.text ?? "",
						html: typeof mail.html === "string" ? mail.html : "",
					};
					appendFileSync(file, `${JSON.stringify(entry)}\n`);
					callback();
				})
				.catch((error) => callback(error));
		},
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, "127.0.0.1", resolve);
	});
	return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
