import { usePublicConfig } from "@/hooks/usePublicConfig/usePublicConfig";

/**
 * ¿Se pueden crear cuentas nuevas? Mientras no se conoce la configuración (o si no se pudo leer),
 * se asume que sí: ofrecer el registro nunca es peor que esconderlo por error.
 */
export function useSignUpEnabled(): boolean {
	return usePublicConfig().data?.signUpEnabled !== false;
}
