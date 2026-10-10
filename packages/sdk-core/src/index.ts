// Núcleo común de los SDK de Sentinel (navegador y Node): nada aquí depende de `window` ni de `process`.

export { BreadcrumbBuffer } from "./breadcrumbs";
export {
	type ClientDeps,
	CoreClient,
	type Platform,
	type Uninstall,
} from "./client";
export { type AddBreadcrumb, installConsole, originalConsole } from "./console";
export { type ParsedDsn, parseDsn } from "./dsn";
export { exceptionFromUnknown } from "./exception";
export { installFetch, type StartHttpSpan } from "./fetch";
export { safeSerialize, stringify } from "./normalize";
export { isInApp, parseStack } from "./stacktrace";
export { GlobalTraceContext, type TraceContext } from "./tracing/context";
export { randomHex } from "./tracing/ids";
export { transactionPayload } from "./tracing/payload";
export { type Clock, Span } from "./tracing/span";
export {
	formatTraceparent,
	type IncomingTrace,
	parseTraceparent,
} from "./tracing/traceparent";
export {
	type HttpSpanHandle,
	type StartTransactionContext,
	statusFromHttp,
	Tracer,
	type TracerConfig,
	type TracerDeps,
} from "./tracing/tracer";
export {
	type IdleOptions,
	type Measurement,
	Transaction,
	type TransactionOptions,
} from "./tracing/transaction";
export { Transport, type TransportOptions } from "./transport";
export type {
	Breadcrumb,
	CaptureHint,
	CoreOptions,
	ExceptionValue,
	Level,
	SentinelEvent,
	SentinelSpan,
	SentinelTransaction,
	StackFrame,
	User,
} from "./types";
export { stripQuery } from "./url";
export { uuid } from "./uuid";
export { installXhr } from "./xhr";
