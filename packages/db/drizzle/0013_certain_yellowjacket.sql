CREATE TABLE "issue_ticket" (
	"issue_id" uuid PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'jira' NOT NULL,
	"external_key" text NOT NULL,
	"external_url" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jira_connection" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"site_url" text NOT NULL,
	"email" text NOT NULL,
	"api_token_encrypted" text NOT NULL,
	"jira_project_key" text NOT NULL,
	"issue_type" text DEFAULT 'Bug' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_ticket" ADD CONSTRAINT "issue_ticket_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_ticket" ADD CONSTRAINT "issue_ticket_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jira_connection" ADD CONSTRAINT "jira_connection_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;