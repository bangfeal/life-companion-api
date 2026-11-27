CREATE TABLE "goal_domains" (
	"goal_id" uuid NOT NULL,
	"domain" varchar(30) NOT NULL,
	CONSTRAINT "goal_domains_goal_id_domain_pk" PRIMARY KEY("goal_id","domain"),
	CONSTRAINT "goal_domain_valid" CHECK ("goal_domains"."domain" IN ('sleep','education'))
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"target_value" double precision NOT NULL,
	"current_value" double precision DEFAULT 0 NOT NULL,
	"unit" varchar(50) NOT NULL,
	"due_date" date,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_id_owner_unique" UNIQUE("id","user_id"),
	CONSTRAINT "goals_title_nonempty" CHECK (length(btrim("goals"."title")) > 0),
	CONSTRAINT "goals_unit_nonempty" CHECK (length(btrim("goals"."unit")) > 0),
	CONSTRAINT "goals_description_length" CHECK ("goals"."description" IS NULL OR length("goals"."description") BETWEEN 1 AND 2000),
	CONSTRAINT "goals_values_valid" CHECK ("goals"."target_value" > 0 AND "goals"."target_value" <= 1e12 AND "goals"."current_value" >= 0 AND "goals"."current_value" <= 1e12),
	CONSTRAINT "goals_status_valid" CHECK ("goals"."status" IN ('active','completed','archived'))
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"habit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"completed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_logs_habit_id_date_pk" PRIMARY KEY("habit_id","date")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"goal_id" uuid,
	"time_zone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habits_id_owner_unique" UNIQUE("id","user_id"),
	CONSTRAINT "habits_title_nonempty" CHECK (length(btrim("habits"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "schedule_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"task_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_title_nonempty" CHECK (length(btrim("schedule_events"."title")) > 0),
	CONSTRAINT "events_description_length" CHECK ("schedule_events"."description" IS NULL OR length("schedule_events"."description") BETWEEN 1 AND 2000),
	CONSTRAINT "events_interval_valid" CHECK ("schedule_events"."ends_at" > "schedule_events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"goal_id" uuid,
	"due_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'todo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_id_owner_unique" UNIQUE("id","user_id"),
	CONSTRAINT "tasks_title_nonempty" CHECK (length(btrim("tasks"."title")) > 0),
	CONSTRAINT "tasks_description_length" CHECK ("tasks"."description" IS NULL OR length("tasks"."description") BETWEEN 1 AND 2000),
	CONSTRAINT "tasks_status_valid" CHECK ("tasks"."status" IN ('todo','done','canceled'))
);
--> statement-breakpoint
ALTER TABLE "goal_domains" ADD CONSTRAINT "goal_domains_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_owner_created_idx" ON "goals" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "habits_owner_created_idx" ON "habits" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "scheduling_owner_created_idx" ON "schedule_events" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "tasks_owner_created_idx" ON "tasks" USING btree ("user_id","created_at","id");