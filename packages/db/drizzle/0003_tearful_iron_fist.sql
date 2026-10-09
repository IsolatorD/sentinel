CREATE TABLE "release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "first_release" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "last_release" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "resolved_release" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "resolved_inclusive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "regressed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "regressed_in_release" text;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_project_version_idx" ON "release" USING btree ("project_id","version");--> statement-breakpoint
CREATE INDEX "release_project_created_idx" ON "release" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "event_issue_environment_idx" ON "event" USING btree ("issue_id","environment");--> statement-breakpoint
CREATE INDEX "event_issue_release_idx" ON "event" USING btree ("issue_id","release");--> statement-breakpoint
CREATE INDEX "event_project_environment_idx" ON "event" USING btree ("project_id","environment");--> statement-breakpoint
CREATE INDEX "event_project_release_idx" ON "event" USING btree ("project_id","release");--> statement-breakpoint
-- Backfill para datos anteriores a esta migración: releases vistas y primera/última release de cada issue.
INSERT INTO "release" ("project_id", "version")
SELECT DISTINCT "project_id", "release" FROM "event" WHERE "release" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "issue" i SET
	"first_release" = (SELECT e."release" FROM "event" e WHERE e."issue_id" = i."id" AND e."release" IS NOT NULL ORDER BY e."timestamp" ASC LIMIT 1),
	"last_release" = (SELECT e."release" FROM "event" e WHERE e."issue_id" = i."id" AND e."release" IS NOT NULL ORDER BY e."timestamp" DESC LIMIT 1);
