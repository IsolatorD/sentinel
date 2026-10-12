import { useCallback, useState } from "react";
import { readStorage, writeStorage } from "@/utils/storage/storage";
import { SIDEBAR_COLLAPSED_KEY } from "@/utils/storage/storage.constants";

/** Si la barra lateral de escritorio está en modo mini (solo iconos). Se recuerda en este navegador. */
export function useSidebarCollapsed() {
	const [collapsed, setCollapsed] = useState(
		() => readStorage(SIDEBAR_COLLAPSED_KEY) === "1",
	);
	const toggle = useCallback(
		() =>
			setCollapsed((current) => {
				writeStorage(SIDEBAR_COLLAPSED_KEY, current ? "0" : "1");
				return !current;
			}),
		[],
	);
	return { collapsed, toggle };
}
