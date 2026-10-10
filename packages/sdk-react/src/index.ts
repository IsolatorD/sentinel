// Todo el SDK del navegador se reexporta, para necesitar un solo import en una app React.
export * from "@sentinel/browser";
export {
	ErrorBoundary,
	type ErrorBoundaryProps,
	type FallbackProps,
} from "./error-boundary";
export { Profiler, type ProfilerProps, withProfiler } from "./profiler";
export {
	type RootErrorInfo,
	type RootOptions,
	reactRootOptions,
} from "./root-options";
export { withErrorBoundary } from "./with-error-boundary";
