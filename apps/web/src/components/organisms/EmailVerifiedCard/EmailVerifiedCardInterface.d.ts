export interface EmailVerifiedCardProps {
	/** Código de error que añade el servidor al enlace cuando la verificación falla. */
	error?: string;
	/** Destino al que seguir tras verificar. */
	redirect?: string;
}
