import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiDefaultResponse,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import {
	type ListSamplesQuery,
	type ListTransactionsQuery,
	listSamplesQuerySchema,
	listTransactionsQuerySchema,
	type OverviewQuery,
	overviewQuerySchema,
	traceIdParamSchema,
} from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { ApiZodQuery } from "../openapi/zod-schema.js";
import { PerformanceService } from "./performance.service.js";

type User = AuthSession["user"];

@ApiTags("Performance")
@ApiSecurity("session")
@ApiDefaultResponse({ description: "Error", schema: docs.error })
@Controller("organizations/:orgId/projects/:projectId/performance")
@UseGuards(AuthGuard)
export class PerformanceController {
	constructor(private readonly performance: PerformanceService) {}

	@Get("transactions")
	@ApiOperation({
		summary: "Transacciones agrupadas por nombre",
		description:
			"Por cada transacción: número de ocurrencias, p50/p95/p99 de la duración, tasa de errores y throughput (por minuto) en el periodo.",
	})
	@ApiZodQuery(listTransactionsQuerySchema)
	@ApiOkResponse({ schema: docs.transactionList })
	list(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Query(new ZodValidationPipe(listTransactionsQuerySchema))
		query: ListTransactionsQuery,
	) {
		return this.performance.transactions(user.id, orgId, projectId, query);
	}

	@Get("overview")
	@ApiOperation({
		summary: "Resumen y serie temporal de rendimiento",
		description:
			"Resumen del periodo (percentiles, errores, throughput), serie continua con p50/p95 por intervalo y Web Vitals valorados (p75). Con `name`, solo de esa transacción.",
	})
	@ApiZodQuery(overviewQuerySchema)
	@ApiOkResponse({ schema: docs.performanceOverview })
	overview(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Query(new ZodValidationPipe(overviewQuerySchema)) query: OverviewQuery,
	) {
		return this.performance.overview(user.id, orgId, projectId, query);
	}

	@Get("samples")
	@ApiOperation({
		summary: "Ejemplos de una transacción (las más lentas o las más recientes)",
	})
	@ApiZodQuery(listSamplesQuerySchema)
	@ApiOkResponse({ schema: docs.sampleList })
	samples(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Query(new ZodValidationPipe(listSamplesQuerySchema))
		query: ListSamplesQuery,
	) {
		return this.performance.samples(user.id, orgId, projectId, query);
	}

	@Get("traces/:traceId")
	@ApiOperation({
		summary:
			"Una traza completa: las transacciones de cada servicio y los errores ocurridos",
		description:
			"Une lo que el navegador y el backend midieron con el mismo `trace_id`, y los errores capturados durante la traza.",
	})
	@ApiOkResponse({ schema: docs.trace })
	trace(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("traceId", new ZodValidationPipe(traceIdParamSchema))
		traceId: string,
	) {
		return this.performance.trace(user.id, orgId, projectId, traceId);
	}

	@Get("samples/:transactionId")
	@ApiOperation({
		summary: "Una transacción con sus spans, lista para dibujar la cascada",
	})
	@ApiOkResponse({ schema: docs.sampleDetail })
	sample(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("transactionId", ParseUUIDPipe) transactionId: string,
	) {
		return this.performance.sample(user.id, orgId, projectId, transactionId);
	}
}
