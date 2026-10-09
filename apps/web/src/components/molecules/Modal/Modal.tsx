import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ModalProps } from "@/components/molecules/Modal/ModalInterface";

export function Modal({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
}: ModalProps) {
	const { t } = useTranslation();
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-sidebar/50 backdrop-blur-[1px]" />
				<Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface shadow-xl focus:outline-none">
					<div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
						<div>
							<Dialog.Title className="text-base font-semibold text-foreground">
								{title}
							</Dialog.Title>
							{description ? (
								<Dialog.Description className="mt-1 text-sm text-muted">
									{description}
								</Dialog.Description>
							) : (
								<Dialog.Description className="sr-only">
									{title}
								</Dialog.Description>
							)}
						</div>
						<Dialog.Close
							aria-label={t("common.close")}
							className="rounded p-1 text-faint hover:bg-subtle hover:text-foreground"
						>
							<X className="size-4" />
						</Dialog.Close>
					</div>
					{children && <div className="px-5 py-4">{children}</div>}
					{footer && (
						<div className="flex justify-end gap-2 border-t border-border bg-subtle/60 px-5 py-3">
							{footer}
						</div>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
