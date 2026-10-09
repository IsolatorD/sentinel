import {
	createProjectKeySchema,
	createProjectSchema,
	errorResponseSchema,
	healthResponseSchema,
	ingestEventSchema,
	ingestResponseSchema,
	projectDtoSchema,
	projectKeyDtoSchema,
	updateProjectKeySchema,
	updateProjectSchema,
} from "@sentinel/shared";
import { z } from "zod";
import { jsonSchema } from "./zod-schema.js";

// Esquemas JSON precalculados para los decoradores de Swagger.
export const docs = {
	error: jsonSchema(errorResponseSchema),
	health: jsonSchema(healthResponseSchema),
	project: jsonSchema(projectDtoSchema),
	projectList: jsonSchema(z.array(projectDtoSchema)),
	projectKey: jsonSchema(projectKeyDtoSchema),
	ingestResponse: jsonSchema(ingestResponseSchema),
	createProject: jsonSchema(createProjectSchema, "input"),
	updateProject: jsonSchema(updateProjectSchema, "input"),
	createKey: jsonSchema(createProjectKeySchema, "input"),
	updateKey: jsonSchema(updateProjectKeySchema, "input"),
	ingestEvent: jsonSchema(ingestEventSchema, "input"),
};
