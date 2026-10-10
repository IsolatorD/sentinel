import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/services/authService/authService";
import * as fx from "@/test/fixtures";
import { ISSUES_PATH, mockHappyPath, renderApp } from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

describe("el servidor no contesta", () => {
	it("en lugar del error técnico explica qué pasa, y al reintentar carga cuando ya responde", async () => {
		vi.mocked(authService.getSession)
			.mockRejectedValueOnce(new ApiError(502, "Request failed"))
			.mockResolvedValue({ user: fx.user });
		const { user } = renderApp(ISSUES_PATH);

		expect(
			await screen.findByText("Can't reach the server"),
		).toBeInTheDocument();
		expect(screen.queryByText("Request failed")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(
			await screen.findByRole("heading", { name: "Issues" }),
		).toBeInTheDocument();
		expect(
			screen.queryByText("Can't reach the server"),
		).not.toBeInTheDocument();
	});

	it("un error que no es de conexión muestra el mensaje genérico", async () => {
		vi.mocked(authService.getSession).mockRejectedValue(
			new ApiError(500, "boom"),
		);
		renderApp(ISSUES_PATH);
		expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
		expect(
			screen.queryByText("Can't reach the server"),
		).not.toBeInTheDocument();
	});

	it("si el servidor sigue caído, se reintenta sola hasta que contesta", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		try {
			vi.mocked(authService.getSession)
				.mockRejectedValueOnce(new ApiError(502, "Request failed"))
				.mockRejectedValueOnce(new ApiError(502, "Request failed"))
				.mockResolvedValue({ user: fx.user });
			renderApp(ISSUES_PATH);
			expect(
				await screen.findByText("Can't reach the server"),
			).toBeInTheDocument();
			await vi.advanceTimersByTimeAsync(7_000);
			expect(
				await screen.findByRole("heading", { name: "Issues" }),
			).toBeInTheDocument();
			expect(
				vi.mocked(authService.getSession).mock.calls.length,
			).toBeGreaterThanOrEqual(3);
		} finally {
			vi.useRealTimers();
		}
	});
});
