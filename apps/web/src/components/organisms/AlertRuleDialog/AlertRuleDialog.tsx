import {
	ALERT_LEVELS,
	ALERT_TRIGGERS,
	type AlertLevel,
	type AlertTrigger,
	type CreateRuleInput,
} from "@sentinel/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Checkbox } from "@/components/atoms/Checkbox/Checkbox";
import { Input } from "@/components/atoms/Input/Input";
import { Select } from "@/components/atoms/Select/Select";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { Modal } from "@/components/molecules/Modal/Modal";
import {
	COOLDOWN_OPTIONS,
	DEFAULT_COOLDOWN,
	DEFAULT_THRESHOLD,
	DEFAULT_WINDOW,
	WINDOW_OPTIONS,
} from "@/components/organisms/AlertRuleDialog/AlertRuleDialog.constants";
import type {
	AlertRuleDialogProps,
	RuleFormErrors,
} from "@/components/organisms/AlertRuleDialog/AlertRuleDialogInterface";
import { useCreateRule, useUpdateRule } from "@/hooks/useAlerts/useAlerts";
import { ApiError } from "@/utils/apiError/apiError";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";
import { describeMinutes } from "@/utils/duration/duration";

/** Crea o edita una regla de alerta. Para reiniciar el formulario, el padre cambia su `key`. */
export function AlertRuleDialog({
	open,
	onOpenChange,
	scope,
	channels,
	rule,
}: AlertRuleDialogProps) {
	const { t } = useTranslation();
	const create = useCreateRule(scope);
	const update = useUpdateRule(scope);
	const mutation = rule ? update : create;

	const [name, setName] = useState(rule?.name ?? "");
	const [trigger, setTrigger] = useState<AlertTrigger>(
		rule?.trigger ?? "new_issue",
	);
	const [threshold, setThreshold] = useState(
		rule?.threshold ? String(rule.threshold) : DEFAULT_THRESHOLD,
	);
	const [windowMinutes, setWindowMinutes] = useState(
		rule?.windowMinutes ?? DEFAULT_WINDOW,
	);
	const [cooldown, setCooldown] = useState(
		rule?.cooldownMinutes ?? DEFAULT_COOLDOWN,
	);
	const [environment, setEnvironment] = useState(rule?.environment ?? "");
	const [minLevel, setMinLevel] = useState<AlertLevel | "">(
		rule?.minLevel ?? "",
	);
	const [channelIds, setChannelIds] = useState<string[]>(
		rule?.channelIds ?? [],
	);
	const [enabled, setEnabled] = useState(rule?.enabled ?? true);
	const [errors, setErrors] = useState<RuleFormErrors>({});

	const duration = (minutes: number) => {
		const { unit, count } = describeMinutes(minutes);
		return t(`alerts.duration.${unit}`, { count });
	};

	/** Un error deja de mostrarse en cuanto el usuario toca el campo. */
	const clearError = (field: keyof RuleFormErrors) =>
		setErrors((current) => ({ ...current, [field]: undefined }));

	function toggleChannel(id: string) {
		clearError("channels");
		setChannelIds((current) =>
			current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
		);
	}

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		const next: RuleFormErrors = {};
		const trimmed = name.trim();
		if (!trimmed) next.name = t("auth.validation.required");
		const count = Number(threshold);
		if (
			trigger === "frequency" &&
			(!Number.isInteger(count) || count < 1 || count > 100_000)
		)
			next.threshold = t("alerts.rules.dialog.thresholdInvalid");
		if (channelIds.length === 0)
			next.channels = t("alerts.rules.dialog.channelsRequired");
		setErrors(next);
		if (Object.keys(next).length > 0) return;

		const frequency = trigger === "frequency";
		const close = { onSuccess: () => onOpenChange(false) };
		if (rule) {
			update.mutate(
				{
					ruleId: rule.id,
					input: {
						name: trimmed,
						trigger,
						threshold: frequency ? count : null,
						windowMinutes: frequency ? windowMinutes : null,
						cooldownMinutes: cooldown,
						environment: environment.trim() || null,
						minLevel: minLevel || null,
						channelIds,
						enabled,
					},
				},
				close,
			);
		} else {
			const input: CreateRuleInput = {
				name: trimmed,
				trigger,
				cooldownMinutes: cooldown,
				channelIds,
				enabled,
				...(frequency && { threshold: count, windowMinutes }),
				...(environment.trim() && { environment: environment.trim() }),
				...(minLevel && { minLevel }),
			};
			create.mutate(input, close);
		}
	}

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={t(
				rule
					? "alerts.rules.dialog.editTitle"
					: "alerts.rules.dialog.createTitle",
			)}
		>
			<form
				onSubmit={onSubmit}
				noValidate
				className="space-y-4"
				data-testid="alert-rule-form"
			>
				{mutation.isError && (
					<Alert variant="error">
						{mutation.error instanceof ApiError && mutation.error.status === 403
							? t("alerts.forbidden")
							: apiErrorText(mutation.error, t("common.genericError"))}
					</Alert>
				)}
				<FormField
					label={t("alerts.rules.dialog.name")}
					htmlFor="rule-name"
					error={errors.name}
				>
					<Input
						id="rule-name"
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							clearError("name");
						}}
						invalid={Boolean(errors.name)}
						maxLength={80}
						autoFocus
					/>
				</FormField>
				<FormField
					label={t("alerts.rules.dialog.trigger")}
					htmlFor="rule-trigger"
				>
					<Select
						id="rule-trigger"
						value={trigger}
						onChange={(e) => setTrigger(e.target.value as AlertTrigger)}
					>
						{ALERT_TRIGGERS.map((id) => (
							<option key={id} value={id}>
								{t(`alerts.rules.triggers.${id}`)}
							</option>
						))}
					</Select>
				</FormField>
				{trigger === "frequency" && (
					<div className="grid grid-cols-2 gap-3">
						<FormField
							label={t("alerts.rules.dialog.threshold")}
							htmlFor="rule-threshold"
							error={errors.threshold}
						>
							<Input
								id="rule-threshold"
								type="number"
								min={1}
								value={threshold}
								onChange={(e) => {
									setThreshold(e.target.value);
									clearError("threshold");
								}}
								invalid={Boolean(errors.threshold)}
							/>
						</FormField>
						<FormField
							label={t("alerts.rules.dialog.window")}
							htmlFor="rule-window"
						>
							<Select
								id="rule-window"
								value={windowMinutes}
								onChange={(e) => setWindowMinutes(Number(e.target.value))}
							>
								{WINDOW_OPTIONS.map((minutes) => (
									<option key={minutes} value={minutes}>
										{duration(minutes)}
									</option>
								))}
							</Select>
						</FormField>
					</div>
				)}
				<div className="grid grid-cols-2 gap-3">
					<FormField
						label={t("alerts.rules.dialog.environment")}
						htmlFor="rule-environment"
						hint={t("alerts.rules.dialog.environmentHint")}
					>
						<Input
							id="rule-environment"
							value={environment}
							onChange={(e) => setEnvironment(e.target.value)}
							maxLength={64}
						/>
					</FormField>
					<FormField
						label={t("alerts.rules.dialog.minLevel")}
						htmlFor="rule-level"
					>
						<Select
							id="rule-level"
							value={minLevel}
							onChange={(e) => setMinLevel(e.target.value as AlertLevel | "")}
						>
							<option value="">{t("alerts.rules.dialog.anyLevel")}</option>
							{ALERT_LEVELS.map((level) => (
								<option key={level} value={level}>
									{t(`issues.levels.${level}`)}
								</option>
							))}
						</Select>
					</FormField>
				</div>
				<FormField
					label={t("alerts.rules.dialog.cooldown")}
					htmlFor="rule-cooldown"
					hint={t("alerts.rules.dialog.cooldownHint")}
				>
					<Select
						id="rule-cooldown"
						value={cooldown}
						onChange={(e) => setCooldown(Number(e.target.value))}
					>
						{COOLDOWN_OPTIONS.map((minutes) => (
							<option key={minutes} value={minutes}>
								{minutes === 0
									? t("alerts.rules.dialog.noCooldown")
									: duration(minutes)}
							</option>
						))}
					</Select>
				</FormField>
				<fieldset>
					<legend className="mb-1 text-xs font-medium text-muted">
						{t("alerts.rules.dialog.channels")}
					</legend>
					<div className="space-y-1.5 rounded-md border border-border p-3">
						{channels.map((channel) => (
							<label
								key={channel.id}
								className="flex cursor-pointer items-center gap-2 text-sm"
							>
								<Checkbox
									checked={channelIds.includes(channel.id)}
									onChange={() => toggleChannel(channel.id)}
								/>
								<span className="truncate">{channel.name}</span>
								<span className="text-xs text-faint">
									{t(`alerts.channels.types.${channel.type}`)}
								</span>
							</label>
						))}
					</div>
					{errors.channels && (
						<p role="alert" className="mt-1 text-xs text-danger">
							{errors.channels}
						</p>
					)}
				</fieldset>
				<label className="flex cursor-pointer items-center gap-2 text-sm">
					<Checkbox
						checked={enabled}
						onChange={(e) => setEnabled(e.target.checked)}
					/>
					{t("alerts.rules.dialog.enabled")}
				</label>
				<div className="flex justify-end gap-2">
					<Button onClick={() => onOpenChange(false)}>
						{t("common.cancel")}
					</Button>
					<Button type="submit" variant="primary" loading={mutation.isPending}>
						{t(rule ? "common.save" : "common.create")}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
