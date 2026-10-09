/** 90 -> { unit: "minutes", count: 90 }; 120 -> { unit: "hours", count: 2 }. Usa la unidad más grande exacta. */
export function describeMinutes(minutes: number): {
	unit: "minutes" | "hours" | "days";
	count: number;
} {
	if (minutes >= 1440 && minutes % 1440 === 0)
		return { unit: "days", count: minutes / 1440 };
	if (minutes >= 60 && minutes % 60 === 0)
		return { unit: "hours", count: minutes / 60 };
	return { unit: "minutes", count: minutes };
}
