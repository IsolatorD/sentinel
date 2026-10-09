CREATE TABLE "alert_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text DEFAULT 'alert' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rule_id" uuid,
	"rule_name" text,
	"channel_id" uuid,
	"channel_name" text NOT NULL,
	"channel_type" text NOT NULL,
	"issue_id" uuid,
	"issue_title" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"status_code" integer,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alert_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger" text NOT NULL,
	"threshold" integer,
	"window_minutes" integer,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"environment" text,
	"min_level" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rule_channel" (
	"rule_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "alert_rule_channel_rule_id_channel_id_pk" PRIMARY KEY("rule_id","channel_id")
);
--> statement-breakpoint
ALTER TABLE "alert_channel" ADD CONSTRAINT "alert_channel_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery" ADD CONSTRAINT "alert_delivery_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery" ADD CONSTRAINT "alert_delivery_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery" ADD CONSTRAINT "alert_delivery_channel_id_alert_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_delivery" ADD CONSTRAINT "alert_delivery_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule_channel" ADD CONSTRAINT "alert_rule_channel_rule_id_alert_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule_channel" ADD CONSTRAINT "alert_rule_channel_channel_id_alert_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_channel_project_idx" ON "alert_channel" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "alert_delivery_project_created_idx" ON "alert_delivery" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "alert_rule_project_idx" ON "alert_rule" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "alert_rule_channel_channel_idx" ON "alert_rule_channel" USING btree ("channel_id");