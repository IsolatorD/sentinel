import { LIMITS } from "./normalize";
import type { Breadcrumb } from "./types";

/** Buffer circular: conserva solo los últimos N breadcrumbs. */
export class BreadcrumbBuffer {
	private items: Breadcrumb[] = [];
	private readonly max: number;

	constructor(max = 50) {
		this.max = Math.max(0, Math.min(max, LIMITS.breadcrumbs));
	}

	add(crumb: Breadcrumb): void {
		if (this.max === 0) return;
		this.items.push({ timestamp: new Date().toISOString(), ...crumb });
		if (this.items.length > this.max) this.items.shift();
	}

	list(): Breadcrumb[] {
		return [...this.items];
	}

	clear(): void {
		this.items = [];
	}
}
