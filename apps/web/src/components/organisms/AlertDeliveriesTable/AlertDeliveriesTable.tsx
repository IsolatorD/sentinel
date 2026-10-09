import { Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Alert } from "@/components/molecules/Alert/Alert";
import { DeliveryStatusBadge } from "@/components/molecules/DeliveryStatusBadge/DeliveryStatusBadge";
import { EmptyState } from "@/components/molecules/EmptyState/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { Pagination } from "@/components/molecules/Pagination/Pagination";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import type { AlertDeliveriesTableProps } from "@/components/organisms/AlertDeliveriesTable/AlertDeliveriesTableInterface";
import { useAlertDeliveries } from "@/hooks/useAlerts/useAlerts";
import { ApiError } from "@/utils/apiError/apiError";
import { PAGE_SIZE } from "@/utils/searchParams/searchParams.constants";

export function AlertDeliveriesTable({
	scope,
	orgSlug,
	projectSlug,
	offset,
	onOffsetChange,
}: AlertDeliveriesTableProps) {
	const { t } = useTranslation();
	const deliveries = useAlertDeliveries(scope, { limit: PAGE_SIZE, offset });

	if (deliveries.isError) {
		return deliveries.error instanceof ApiError &&
			deliveries.error.status === 403 ? (
			<Alert variant="error">{t("alerts.forbidden")}</Alert>
		) : (
			<ErrorState
				title={t("alerts.history.loadError")}
				onRetry={() => deliveries.refetch()}
			/>
		);
	}

	return (
		<div className="space-y-3">
			<Card className="overflow-x-auto">
				{!deliveries.data ? (
					<div className="space-y-3 p-5">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				) : deliveries.data.items.length === 0 ? (
					<EmptyState
						icon={History}
						title={t("alerts.history.empty.title")}
						description={t("alerts.history.empty.description")}
					/>
				) : (
					<table
						className="w-full text-left text-sm"
						data-testid="deliveries-table"
					>
						<thead>
							<tr className="border-b border-border bg-subtle/70 text-[11px] tracking-wide text-faint uppercase">
								<th className="px-5 py-2 font-medium">
									{t("alerts.history.columns.when")}
								</th>
								<th className="px-3 py-2 font-medium">
									{t("alerts.history.columns.status")}
								</th>
								<th className="px-3 py-2 font-medium">
									{t("alerts.history.columns.channel")}
								</th>
								<th className="px-3 py-2 font-medium">
									{t("alerts.history.columns.alert")}
								</th>
							</tr>
						</thead>
						<tbody>
							{deliveries.data.items.map((d) => (
								<tr
									key={d.id}
									className="border-b border-border align-top last:border-b-0"
									data-testid="delivery-row"
								>
									<td className="px-5 py-2.5 whitespace-nowrap">
										<RelativeTime date={d.createdAt} />
									</td>
									<td className="px-3 py-2.5">
										<DeliveryStatusBadge status={d.status} />
										{d.error && (
											<p className="mt-1 max-w-xs text-xs break-words text-danger">
												{d.error}
											</p>
										)}
										{d.attempts > 1 && (
											<p className="mt-1 text-xs text-faint">
												{t("alerts.history.attempts", { count: d.attempts })}
											</p>
										)}
									</td>
									<td className="px-3 py-2.5">
										<div className="text-foreground">{d.channelName}</div>
										<div className="text-xs text-faint">
											{t(`alerts.channels.types.${d.channelType}`)}
										</div>
									</td>
									<td className="px-3 py-2.5">
										{d.kind === "test" ? (
											<span className="text-muted">
												{t("alerts.history.test")}
											</span>
										) : (
											<>
												<div className="text-xs text-muted">{d.ruleName}</div>
												{d.issueId ? (
													<Link
														to="/$orgSlug/projects/$projectSlug/issues/$issueId"
														params={{
															orgSlug,
															projectSlug,
															issueId: d.issueId,
														}}
														className="line-clamp-1 text-primary hover:underline"
													>
														{d.issueTitle}
													</Link>
												) : (
													<span className="text-muted">{d.issueTitle}</span>
												)}
											</>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>
			{deliveries.data && (
				<Pagination
					offset={offset}
					limit={PAGE_SIZE}
					total={deliveries.data.total}
					onChange={onOffsetChange}
				/>
			)}
		</div>
	);
}
