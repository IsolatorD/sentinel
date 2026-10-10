import { Cpu, Database, Inbox, Monitor, Radio, Server } from "lucide-react";

/** Los bloques del recorrido de un evento, de izquierda a derecha (`landing.architecture.flow.<id>`). */
export const FLOW = [
	{ id: "sdk", icon: Radio },
	{ id: "api", icon: Server },
	{ id: "queue", icon: Inbox },
	{ id: "worker", icon: Cpu },
	{ id: "db", icon: Database },
	{ id: "web", icon: Monitor },
] as const;

export const STACK = [
	"NestJS",
	"Fastify",
	"PostgreSQL",
	"Drizzle",
	"Redis",
	"BullMQ",
	"Better Auth",
	"Zod",
	"React 19",
	"Vite",
	"TanStack Router",
	"TanStack Query",
	"Tailwind 4",
	"Vitest",
	"Turborepo",
	"pnpm",
] as const;

export const RUN_COMMANDS = [
	"cp .env.example .env",
	"pnpm install",
	"pnpm infra:up      # Postgres, Redis, Mailpit",
	"pnpm db:migrate",
	"pnpm dev           # API :3000 · worker · web :5173",
	"pnpm seed:demo     # demo@sentinel.dev",
].join("\n");
