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
