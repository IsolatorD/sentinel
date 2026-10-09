import type { Breadcrumb } from "../types";

export type AddBreadcrumb = (crumb: Breadcrumb) => void;
/** Quita la instrumentación y deja todo como estaba. */
export type Uninstall = () => void;
