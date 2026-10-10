/**
 * Lo poco que se necesita de `react-native`. Se carga con `require` y no con `import`: así el SDK no
 * falla (y se puede probar) fuera de una app de React Native.
 */
export interface ReactNativeModule {
	Platform?: { OS: string; Version: string | number };
	AppState?: {
		currentState?: string;
		addEventListener(
			type: "change",
			listener: (state: string) => void,
		): { remove(): void } | undefined;
	};
}

declare const require: ((id: string) => unknown) | undefined;

export function loadReactNative(): ReactNativeModule | undefined {
	try {
		return typeof require === "function"
			? (require("react-native") as ReactNativeModule)
			: undefined;
	} catch {
		return undefined;
	}
}

/** Hermes o JavaScriptCore: cambia el formato de los stacks y cómo se simbolizan. */
export function jsEngine(): "hermes" | "jsc" {
	return (globalThis as { HermesInternal?: unknown }).HermesInternal
		? "hermes"
		: "jsc";
}
