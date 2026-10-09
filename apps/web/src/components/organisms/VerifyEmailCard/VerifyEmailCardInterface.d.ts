export interface VerifyEmailCardProps {
	/** Dirección a la que se envió el enlace. */
	email?: string;
	/** Destino al que seguir tras verificar (p. ej. una invitación). */
	redirect?: string;
}
