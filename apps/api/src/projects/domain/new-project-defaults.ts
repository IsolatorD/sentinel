/** Valores configurados por el operador para los proyectos nuevos (ver `DEFAULT_*` en la configuración). */
export interface NewProjectDefaultsEnv {
	retentionDays?: number;
	monthlyEventQuota?: number;
	monthlyTransactionQuota?: number;
}

/**
 * Los campos con los que debe nacer un proyecto. Solo incluye lo que el operador configuró: lo que
 * falta lo decide la base de datos (retención de 90 días, sin cuotas). Así una instancia abierta al
 * público puede acotar lo que cada cuenta nueva puede ocupar sin cambiar lo ya existente.
 */
export function newProjectDefaults(env: NewProjectDefaultsEnv) {
	return {
		...(env.retentionDays !== undefined && {
			retentionDays: env.retentionDays,
		}),
		...(env.monthlyEventQuota !== undefined && {
			monthlyEventQuota: env.monthlyEventQuota,
		}),
		...(env.monthlyTransactionQuota !== undefined && {
			monthlyTransactionQuota: env.monthlyTransactionQuota,
		}),
	};
}
