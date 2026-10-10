import { Injectable } from "@nestjs/common";
import {
	type DashboardDto,
	type DashboardQuery,
	PERIOD_CONFIG,
} from "@sentinel/shared";
import { bucketRange } from "../issues/stats/stats.domain.js";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { mergeSeries, topWithOthers } from "./dashboard.domain.js";
import { DashboardRepository, type Window } from "./dashboard.repository.js";

const TOP = 5;
const BREAKDOWN_ITEMS = 5;

@Injectable()
export class DashboardService {
	constructor(
		private readonly repo: DashboardRepository,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
	) {}

	async get(
		userId: string,
		orgId: string,
		projectId: string,
		query: DashboardQuery,
		now = new Date(),
	): Promise<DashboardDto> {
		await this.access.assert(userId, orgId, "member");
		await this.projects.ensureExists(orgId, projectId);

		const range = bucketRange(now, query.period);
		const length = range.to.getTime() - range.from.getTime();
		const current: Window = {
			projectId,
			from: range.from,
			to: new Date(now.getTime() + 1),
			environment: query.environment,
		};
		// El periodo anterior dura lo mismo y termina donde empieza este.
		const before: Window = {
			...current,
			from: new Date(range.from.getTime() - length),
			to: range.from,
		};

		const [
			events,
			newIssues,
			resolved,
			tx,
			prevEvents,
			prevIssues,
			prevTx,
			series,
			levels,
			environments,
			releases,
			topIssues,
			slowest,
		] = await Promise.all([
			this.repo.eventTotals(current),
			this.repo.newIssues(current),
			this.repo.resolvedIssues(current),
			this.repo.transactionTotals(current),
			this.repo.eventTotals(before),
			this.repo.newIssues(before),
			this.repo.transactionTotals(before),
			this.repo.series(current, PERIOD_CONFIG[query.period].bucketHours),
			this.repo.breakdown(current, "level"),
			this.repo.breakdown(current, "environment"),
			this.repo.breakdown(current, "release"),
			this.repo.topIssues(current, TOP),
			this.repo.slowest(current, TOP),
		]);

		return {
			period: query.period,
			bucketMinutes: range.bucketMs / 60_000,
			from: range.from.toISOString(),
			to: range.to.toISOString(),
			totals: {
				events: events.events,
				users: events.users,
				newIssues,
				resolvedIssues: resolved,
				transactions: tx.count,
				p95: tx.p95,
				errorRate: tx.count === 0 ? 0 : tx.errors / tx.count,
			},
			previous: {
				events: prevEvents.events,
				newIssues: prevIssues,
				transactions: prevTx.count,
			},
			series: mergeSeries(series, range),
			byLevel: levels,
			byEnvironment: topWithOthers(environments, BREAKDOWN_ITEMS),
			byRelease: topWithOthers(releases, BREAKDOWN_ITEMS),
			topIssues,
			slowest,
		};
	}
}
