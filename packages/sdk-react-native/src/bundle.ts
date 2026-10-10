import type { SentinelEvent } from "@sentinel/core";

const BUNDLE = /(?:^|\/)([^/?#]+\.(?:bundle|jsbundle))(?:[?#].*)?$/;

/**
 * En un móvil el código está en un solo archivo (`index.android.bundle`, a veces con la ruta del
 * dispositivo). Se envía como `app:///index.android.bundle`: el servidor lo busca así entre los
 * source maps de la release (`sentinel-cli sourcemaps upload` guarda `~/index.android.bundle`), sin
 * importar dónde esté instalada la app. La ruta original queda en `abs_path`.
 */
export function bundleFilename(filename: string): string {
	const match = BUNDLE.exec(filename);
	return match ? `app:///${match[1]}` : filename;
}

export function normalizeBundleFrames(event: SentinelEvent): SentinelEvent {
	if (!event.exception) return event;
	return {
		...event,
		exception: {
			values: event.exception.values.map((value) => {
				if (!value.stacktrace) return value;
				return {
					...value,
					stacktrace: {
						frames: value.stacktrace.frames.map((frame) => {
							if (!frame.filename) return frame;
							const filename = bundleFilename(frame.filename);
							return filename === frame.filename
								? frame
								: { ...frame, filename, abs_path: frame.filename };
						}),
					},
				};
			}),
		},
	};
}
