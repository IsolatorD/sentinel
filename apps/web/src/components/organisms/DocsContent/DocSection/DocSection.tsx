import type { DocSectionProps } from "@/components/organisms/DocsContent/DocSection/DocSectionInterface";

export function DocSection({ id, title, intro, children }: DocSectionProps) {
	return (
		<section
			id={id}
			className="scroll-mt-24 border-b border-border pb-10 last:border-b-0"
		>
			<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
			{intro && <p className="mt-2 text-muted">{intro}</p>}
			<div className="mt-5 space-y-4">{children}</div>
		</section>
	);
}
