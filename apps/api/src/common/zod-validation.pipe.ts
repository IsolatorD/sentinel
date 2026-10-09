import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/** Falló la validación de un cuerpo o consulta: el filtro lo traduce al idioma de la petición. */
export class ZodValidationException extends BadRequestException {
	constructor(
		readonly schema: ZodType,
		readonly value: unknown,
	) {
		super({ reason: "VALIDATION_FAILED" });
	}
}

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
	constructor(private readonly schema: ZodType<T>) {}

	transform(value: unknown): T {
		const result = this.schema.safeParse(value);
		if (!result.success) throw new ZodValidationException(this.schema, value);
		return result.data;
	}
}
