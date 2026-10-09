#!/usr/bin/env node
import { run } from "./cli.js";

run(process.argv.slice(2), process.env, {
	out: (line) => console.log(line),
	err: (line) => console.error(line),
}).then(
	(code) => {
		process.exitCode = code;
	},
	(error) => {
		console.error(`Unexpected error: ${(error as Error).message}`);
		process.exitCode = 1;
	},
);
