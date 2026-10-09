import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
	it("une clases condicionales y la última de Tailwind gana", () => {
		expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
		expect(cn("a", undefined, ["b", { c: true, d: false }])).toBe("a b c");
	});
});
