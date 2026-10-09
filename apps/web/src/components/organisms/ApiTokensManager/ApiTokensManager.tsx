import type { ApiTokenDto, CreatedApiTokenDto } from "@sentinel/shared";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Card } from "@/components/atoms/Card/Card";
import { Input } from "@/components/atoms/Input/Input";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Alert } from "@/components/molecules/Alert/Alert";
import { CopyButton } from "@/components/molecules/CopyButton/CopyButton";
import { EmptyState } from "@/components/molecules/EmptyState/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { Modal } from "@/components/molecules/Modal/Modal";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import {
	useCreateToken,
	useRevokeToken,
	useTokens,
} from "@/hooks/useTokens/useTokens";
import { staggerStyle } from "@/utils/animation/animation";
import { ApiError } from "@/utils/apiError/apiError";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";

export function ApiTokensManager({ orgId }: { orgId: string }) {
	const { t } = useTranslation();
	const tokens = useTokens(orgId);
	const create = useCreateToken(orgId);
	const revoke = useRevokeToken(orgId);
	const [name, setName] = useState("");
	const [created, setCreated] = useState<CreatedApiTokenDto>();
	const [toRevoke, setToRevoke] = useState<ApiTokenDto>();

	if (tokens.error instanceof ApiError && tokens.error.status === 403) {
		return <Alert variant="error">{t("tokens.forbidden")}</Alert>;
	}
	if (tokens.isError) {
		return (
			<ErrorState
				title={t("tokens.loadError")}
				onRetry={() => tokens.refetch()}
			/>
		);
	}

	function onCreate(event: FormEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		create.mutate(trimmed, {
			onSuccess: (token) => {
				setName("");
				setCreated(token);
			},
		});
	}

	const failure = [create, revoke].find((m) => m.isError);

	return (
		<div className="space-y-4">
			<Card className="p-5">
				<form onSubmit={onCreate} className="flex flex-wrap gap-2">
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t("tokens.namePlaceholder")}
						aria-label={t("tokens.name")}
						maxLength={60}
						className="max-w-xs"
					/>
					<Button
						type="submit"
						loading={create.isPending}
						disabled={!name.trim()}
					>
						<Plus className="size-4" />
						{t("tokens.create")}
					</Button>
				</form>
			</Card>

			{failure && (
				<Alert variant="error">
					{apiErrorText(failure.error, t("common.genericError"))}
				</Alert>
			)}

			<Card>
				{!tokens.data ? (
					<div className="space-y-3 p-5">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				) : tokens.data.length === 0 ? (
					<EmptyState
						icon={KeyRound}
						title={t("tokens.empty.title")}
						description={t("tokens.empty.description")}
					/>
				) : (
					<ul className="divide-y divide-border" data-testid="token-list">
						{tokens.data.map((token, index) => (
							<li
								key={token.id}
								className="flex animate-fade-in-up flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3"
								style={staggerStyle(index)}
								data-testid="token-row"
							>
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-medium text-foreground">
										{token.name}
									</div>
									<div className="font-mono text-xs text-muted">
										{token.prefix}…
									</div>
								</div>
								<div className="text-xs text-muted">
									{t("tokens.createdAt")}{" "}
									<RelativeTime date={token.createdAt} />
								</div>
								<div className="text-xs text-muted">
									{token.lastUsedAt ? (
										<>
											{t("tokens.lastUsed")}{" "}
											<RelativeTime date={token.lastUsedAt} />
										</>
									) : (
										t("tokens.neverUsed")
									)}
								</div>
								<Button
									size="sm"
									variant="danger-outline"
									aria-label={`${t("tokens.revoke")} ${token.name}`}
									onClick={() => setToRevoke(token)}
								>
									<Trash2 className="size-3.5" />
								</Button>
							</li>
						))}
					</ul>
				)}
			</Card>

			<Modal
				open={Boolean(created)}
				onOpenChange={(open) => !open && setCreated(undefined)}
				title={t("tokens.createdDialog.title")}
				description={t("tokens.createdDialog.description")}
				footer={
					<Button variant="primary" onClick={() => setCreated(undefined)}>
						{t("tokens.createdDialog.done")}
					</Button>
				}
			>
				<div className="flex items-center gap-2">
					<code
						className="min-w-0 flex-1 truncate rounded border border-border bg-subtle px-2 py-1.5 font-mono text-xs text-foreground"
						data-testid="new-token"
					>
						{created?.token}
					</code>
					<CopyButton value={created?.token ?? ""} />
				</div>
			</Modal>

			<Modal
				open={Boolean(toRevoke)}
				onOpenChange={(open) => !open && setToRevoke(undefined)}
				title={t("tokens.revokeDialog.title", { name: toRevoke?.name ?? "" })}
				description={t("tokens.revokeDialog.description")}
				footer={
					<>
						<Button onClick={() => setToRevoke(undefined)}>
							{t("common.cancel")}
						</Button>
						<Button
							variant="danger"
							loading={revoke.isPending}
							onClick={() =>
								toRevoke &&
								revoke.mutate(toRevoke.id, {
									onSettled: () => setToRevoke(undefined),
								})
							}
						>
							{t("tokens.revoke")}
						</Button>
					</>
				}
			/>
		</div>
	);
}
