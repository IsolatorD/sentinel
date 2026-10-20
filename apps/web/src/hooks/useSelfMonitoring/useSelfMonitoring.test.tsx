import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
	init: vi.fn(),
	close: vi.fn(async () => true),
}));
vi.mock("@argus-isolator/browser", () => sdk);

const config = vi.hoisted(() => ({
	data: undefined as undefined | { monitoringDsn: string | null },
}));
vi.mock("@/hooks/usePublicConfig/usePublicConfig", () => ({
	usePublicConfig: () => config,
}));

import { useSelfMonitoring } from "./useSelfMonitoring";

beforeEach(() => {
	vi.clearAllMocks();
	config.data = undefined;
});

describe("useSelfMonitoring", () => {
	it("no hace nada mientras no se conoce la configuración o si no hay DSN", () => {
		renderHook(() => useSelfMonitoring());
		config.data = { monitoringDsn: null };
		renderHook(() => useSelfMonitoring());
		expect(sdk.init).not.toHaveBeenCalled();
	});

	it("con DSN inicializa la SDK del navegador una vez, y la cierra al desmontar", () => {
		config.data = { monitoringDsn: "https://k@sentinel.example/p" };
		const { rerender, unmount } = renderHook(() => useSelfMonitoring());
		rerender();
		expect(sdk.init).toHaveBeenCalledTimes(1);
		expect(sdk.init.mock.calls[0][0]).toMatchObject({
			dsn: "https://k@sentinel.example/p",
		});
		unmount();
		expect(sdk.close).toHaveBeenCalled();
	});
});
