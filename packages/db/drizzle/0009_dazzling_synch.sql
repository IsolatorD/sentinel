ALTER TABLE "event" ADD COLUMN "trace_id" text;--> statement-breakpoint
CREATE INDEX "event_project_trace_idx" ON "event" USING btree ("project_id","trace_id");
--> statement-breakpoint
-- Los eventos anteriores ya traían la traza dentro del payload: se copia a la nueva columna.
UPDATE "event" SET "trace_id" = lower("payload"->'contexts'->'trace'->>'trace_id') WHERE "payload"->'contexts'->'trace'->>'trace_id' ~* '^[0-9a-f]{32}$';
