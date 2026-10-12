import { Injectable, Logger } from "@nestjs/common";
import { isPerformanceTrigger } from "@sentinel/shared";
import { AlertsService } from "../alerts/alerts.service.js";
import { isBreached, metricValue } from "./performance-alerts.domain.js";
import { PerformanceAlertsRepository } from "./performance-alerts.repository.js";

@Injectable()
export class PerformanceAlertsService {
	private readonly logger = new Logger(PerformanceAlertsService.name);

	constructor(
		private readonly repository: PerformanceAlertsRepository,
		private readonly alerts: AlertsService,
	) {}

	/**
	 * Mide la ventana de cada regla de rendimiento y avisa de las que cruzaron su umbral. Una regla
	 * que falla (p. ej. una consulta lenta) no impide evaluar las demás.
	 * Devuelve cuántos avisos se encolaron.
	 */
	async run(now = new Date()): Promise<number> {
		let sent = 0;
		for (const rule of await this.repository.rules()) {
			if (
				!isPerformanceTrigger(rule.trigger) ||
				rule.threshold === null ||
				rule.windowMinutes === null
			)
				continue;
			try {
				const measurement = await this.repository.measure({
					projectId: rule.projectId,
					since: new Date(now.getTime() - rule.windowMinutes * 60_000),
					environment: rule.environment,
					transactionName: rule.transactionName,
				});
				if (!isBreached(rule.trigger, rule.threshold, measurement)) continue;
				const value = metricValue(rule.trigger, measurement);
				if (value === null) continue;
				const queued = await this.alerts.onPerformanceBreach({
					rule: { ...rule, trigger: rule.trigger },
					value,
					sampleCount: measurement.sampleCount,
				});
				if (queued) sent++;
			} catch (error) {
				this.logger.error(
					`no se pudo evaluar la regla ${rule.id}: ${(error as Error).message}`,
				);
			}
		}
		return sent;
	}
}
