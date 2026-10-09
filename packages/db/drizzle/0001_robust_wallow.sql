CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text NOT NULL,
	"type" text NOT NULL,
	"message" text,
	"release" text,
	"environment" text,
	"platform" text,
	"user_identifier" text,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"culprit" text,
	"type" text NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_issue_timestamp_idx" ON "event" USING btree ("issue_id","timestamp");--> statement-breakpoint
CREATE INDEX "event_project_timestamp_idx" ON "event" USING btree ("project_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_project_fingerprint_idx" ON "issue" USING btree ("project_id","fingerprint");--> statement-breakpoint
CREATE INDEX "issue_project_last_seen_idx" ON "issue" USING btree ("project_id","last_seen");