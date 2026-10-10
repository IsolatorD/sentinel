ALTER TABLE "project" ADD COLUMN "retention_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "monthly_event_quota" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "monthly_transaction_quota" integer;