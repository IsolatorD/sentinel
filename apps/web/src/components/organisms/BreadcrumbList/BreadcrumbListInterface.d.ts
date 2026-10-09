import type { IngestEvent } from "@sentinel/shared";

export type Breadcrumb = NonNullable<IngestEvent["breadcrumbs"]>[number];
