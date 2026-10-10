import { AsyncLocalStorage } from "node:async_hooks";
import type { SentinelEvent } from "@sentinel/core";

/** La petición HTTP que se está atendiendo; los errores capturados mientras tanto la incluyen. */
export const requestScope = new AsyncLocalStorage<{
	request: NonNullable<SentinelEvent["request"]>;
}>();
