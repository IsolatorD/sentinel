export interface SigningSecretDialogProps {
	/** Secreto recién creado; `undefined` mantiene el diálogo cerrado. */
	secret: string | undefined;
	onClose: () => void;
}
