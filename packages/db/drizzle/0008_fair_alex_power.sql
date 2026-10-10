CREATE TABLE "perf_span" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"span_id" text NOT NULL,
	"parent_span_id" text,
	"op" text NOT NULL,
	"description" text,
	"start_timestamp" timestamp with time zone NOT NULL,
	"duration_ms" double precision NOT NULL,
	"status" text,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "perf_transaction" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"trace_id" text NOT NULL,
	"span_id" text NOT NULL,
	"parent_span_id" text,
	"name" text NOT NULL,
	"op" text NOT NULL,
	"status" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" double precision NOT NULL,
	"release" text,
	"environment" text,
	"platform" text,
	"user_identifier" text,
	"measurements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perf_span" ADD CONSTRAINT "perf_span_transaction_id_perf_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."perf_transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_transaction" ADD CONSTRAINT "perf_transaction_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perf_span_transaction_idx" ON "perf_span" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "perf_transaction_project_timestamp_idx" ON "perf_transaction" USING btree ("project_id","timestamp");--> statement-breakpoint
CREATE INDEX "perf_transaction_project_name_timestamp_idx" ON "perf_transaction" USING btree ("project_id","name","timestamp");--> statement-breakpoint
CREATE INDEX "perf_transaction_trace_idx" ON "perf_transaction" USING btree ("trace_id");