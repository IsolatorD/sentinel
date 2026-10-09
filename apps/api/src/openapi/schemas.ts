import {
	createProjectKeySchema,
	createProjectSchema,
	errorResponseSchema,
	eventDetailDtoSchema,
	eventListDtoSchema,
	healthResponseSchema,
	ingestEventSchema,
	ingestResponseSchema,
	issueDetailDtoSchema,
	issueDtoSchema,
	issueListDtoSchema,
	projectDtoSchema,
	projectKeyDtoSchema,
	publicConfigSchema,
	updateIssueSchema,
	updateProjectKeySchema,
	updateProjectSchema,
} from "@sentinel/shared";
import { z } from "zod";
import { jsonSchema } from "./zod-schema.js";

// Esquemas JSON precalculados para los decoradores de Swagger.
export const docs = {
	error: jsonSchema(errorResponseSchema),
	health: jsonSchema(healthResponseSchema),
	publicConfig: jsonSchema(publicConfigSchema),
	project: jsonSchema(projectDtoSchema),
	projectList: jsonSchema(z.array(projectDtoSchema)),
	projectKey: jsonSchema(projectKeyDtoSchema),
	ingestResponse: jsonSchema(ingestResponseSchema),
	createProject: jsonSchema(createProjectSchema, "input"),
	updateProject: jsonSchema(updateProjectSchema, "input"),
	createKey: jsonSchema(createProjectKeySchema, "input"),
	updateKey: jsonSchema(updateProjectKeySchema, "input"),
	ingestEvent: jsonSchema(ingestEventSchema, "input"),
	issueList: jsonSchema(issueListDtoSchema),
	issue: jsonSchema(issueDtoSchema),
	issueDetail: jsonSchema(issueDetailDtoSchema),
	eventList: jsonSchema(eventListDtoSchema),
	eventDetail: jsonSchema(eventDetailDtoSchema),
	updateIssue: jsonSchema(updateIssueSchema, "input"),
};
