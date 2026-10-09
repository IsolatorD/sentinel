import {
	type CreateChannelInput,
	type CreateRuleInput,
	channelDtoSchema,
	channelListDtoSchema,
	createdChannelDtoSchema,
	deliveryDtoSchema,
	deliveryListDtoSchema,
	type ListDeliveriesQuery,
	ruleDtoSchema,
	ruleListDtoSchema,
	type UpdateChannelInput,
	type UpdateRuleInput,
} from "@sentinel/shared";
import { base } from "@/services/alertsService/alertsService.constants";
import { http } from "@/services/http/http";

export const alertsService = {
	// ---------- Canales ----------
	listChannels: (orgId: string, projectId: string) =>
		http(`${base(orgId, projectId)}/channels`, {
			schema: channelListDtoSchema,
		}),

	createChannel: (
		orgId: string,
		projectId: string,
		input: CreateChannelInput,
	) =>
		http(`${base(orgId, projectId)}/channels`, {
			method: "POST",
			body: input,
			schema: createdChannelDtoSchema,
		}),

	updateChannel: (
		orgId: string,
		projectId: string,
		channelId: string,
		input: UpdateChannelInput,
	) =>
		http(`${base(orgId, projectId)}/channels/${channelId}`, {
			method: "PATCH",
			body: input,
			schema: channelDtoSchema,
		}),

	deleteChannel: (orgId: string, projectId: string, channelId: string) =>
		http(`${base(orgId, projectId)}/channels/${channelId}`, {
			method: "DELETE",
		}),

	testChannel: (orgId: string, projectId: string, channelId: string) =>
		http(`${base(orgId, projectId)}/channels/${channelId}/test`, {
			method: "POST",
			body: {},
			schema: deliveryDtoSchema,
		}),

	// ---------- Reglas ----------
	listRules: (orgId: string, projectId: string) =>
		http(`${base(orgId, projectId)}/rules`, { schema: ruleListDtoSchema }),

	createRule: (orgId: string, projectId: string, input: CreateRuleInput) =>
		http(`${base(orgId, projectId)}/rules`, {
			method: "POST",
			body: input,
			schema: ruleDtoSchema,
		}),

	updateRule: (
		orgId: string,
		projectId: string,
		ruleId: string,
		input: UpdateRuleInput,
	) =>
		http(`${base(orgId, projectId)}/rules/${ruleId}`, {
			method: "PATCH",
			body: input,
			schema: ruleDtoSchema,
		}),

	deleteRule: (orgId: string, projectId: string, ruleId: string) =>
		http(`${base(orgId, projectId)}/rules/${ruleId}`, { method: "DELETE" }),

	// ---------- Historial ----------
	listDeliveries: (
		orgId: string,
		projectId: string,
		query: Partial<ListDeliveriesQuery>,
	) =>
		http(`${base(orgId, projectId)}/deliveries`, {
			schema: deliveryListDtoSchema,
			query,
		}),
};
