CREATE TABLE "examinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"time_zone" varchar(100) NOT NULL,
	"duration_minutes" integer,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"score" double precision,
	"max_score" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exams_id_owner_unique" UNIQUE("id","user_id"),
	CONSTRAINT "exams_text_valid" CHECK (length(btrim("examinations"."title"))>0 AND length(btrim("examinations"."subject"))>0),
	CONSTRAINT "exams_status_valid" CHECK ("examinations"."status" IN ('scheduled','completed','canceled')),
	CONSTRAINT "exams_duration_valid" CHECK ("examinations"."duration_minutes" IS NULL OR "examinations"."duration_minutes" BETWEEN 1 AND 1440),
	CONSTRAINT "exams_score_valid" CHECK (("examinations"."score" IS NULL AND "examinations"."max_score" IS NULL) OR ("examinations"."score" IS NOT NULL AND "examinations"."max_score" IS NOT NULL AND "examinations"."status"='completed' AND "examinations"."score">=0 AND "examinations"."score"<="examinations"."max_score" AND "examinations"."max_score">0 AND "examinations"."max_score"<=1e12))
);
--> statement-breakpoint
CREATE TABLE "sleep_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" varchar(100) NOT NULL,
	"awake_minutes" integer DEFAULT 0 NOT NULL,
	"kind" varchar(10) DEFAULT 'main' NOT NULL,
	"quality" integer,
	"notes" text,
	"provenance" varchar(10) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sleep_interval_valid" CHECK ("sleep_sessions"."ends_at">"sleep_sessions"."starts_at" AND "sleep_sessions"."ends_at"<="sleep_sessions"."starts_at"+interval '48 hours'),
	CONSTRAINT "sleep_awake_valid" CHECK ("sleep_sessions"."awake_minutes">=0 AND "sleep_sessions"."awake_minutes" < extract(epoch from ("sleep_sessions"."ends_at"-"sleep_sessions"."starts_at"))/60),
	CONSTRAINT "sleep_kind_valid" CHECK ("sleep_sessions"."kind" IN ('main','nap')),
	CONSTRAINT "sleep_quality_valid" CHECK ("sleep_sessions"."quality" IS NULL OR "sleep_sessions"."quality" BETWEEN 1 AND 5),
	CONSTRAINT "sleep_notes_length" CHECK ("sleep_sessions"."notes" IS NULL OR length("sleep_sessions"."notes") BETWEEN 1 AND 1000),
	CONSTRAINT "sleep_manual_provenance" CHECK ("sleep_sessions"."provenance"='manual')
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"activity" varchar(20) DEFAULT 'practice' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" varchar(100) NOT NULL,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"task_id" uuid,
	"examination_id" uuid,
	"notes" text,
	"provenance" varchar(10) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_subject_nonempty" CHECK (length(btrim("study_sessions"."subject"))>0),
	CONSTRAINT "study_activity_valid" CHECK ("study_sessions"."activity" IN ('reading','practice','review','lecture')),
	CONSTRAINT "study_interval_valid" CHECK ("study_sessions"."ends_at">"study_sessions"."starts_at" AND "study_sessions"."ends_at"<="study_sessions"."starts_at"+interval '24 hours'),
	CONSTRAINT "study_break_valid" CHECK ("study_sessions"."break_minutes">=0 AND "study_sessions"."break_minutes"<extract(epoch from ("study_sessions"."ends_at"-"study_sessions"."starts_at"))/60),
	CONSTRAINT "study_notes_length" CHECK ("study_sessions"."notes" IS NULL OR length("study_sessions"."notes") BETWEEN 1 AND 1000),
	CONSTRAINT "study_manual_provenance" CHECK ("study_sessions"."provenance"='manual')
);
--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_owned_exam_fk" FOREIGN KEY ("examination_id","user_id") REFERENCES "public"."examinations"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exams_owner_scheduled_idx" ON "examinations" USING btree ("user_id","scheduled_at","id");--> statement-breakpoint
CREATE INDEX "sleep_owner_end_idx" ON "sleep_sessions" USING btree ("user_id","ends_at","id");--> statement-breakpoint
CREATE INDEX "study_owner_end_idx" ON "study_sessions" USING btree ("user_id","ends_at","id");--> statement-breakpoint
CREATE INDEX "study_task_owner_idx" ON "study_sessions" USING btree ("task_id","user_id");--> statement-breakpoint
CREATE INDEX "study_exam_owner_idx" ON "study_sessions" USING btree ("examination_id","user_id");--> statement-breakpoint
-- Reviewed SQL contracts: ownership, optional link detachment, overlap exclusion.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE sleep_sessions ADD CONSTRAINT sleep_owner_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE study_sessions ADD CONSTRAINT study_owner_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE examinations ADD CONSTRAINT exams_owner_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE study_sessions ADD CONSTRAINT study_owned_task_fk FOREIGN KEY (task_id,user_id) REFERENCES tasks(id,user_id) ON DELETE SET NULL (task_id);
--> statement-breakpoint
ALTER TABLE study_sessions DROP CONSTRAINT study_owned_exam_fk;
--> statement-breakpoint
ALTER TABLE study_sessions ADD CONSTRAINT study_owned_exam_fk FOREIGN KEY (examination_id,user_id) REFERENCES examinations(id,user_id) ON DELETE SET NULL (examination_id);
--> statement-breakpoint
ALTER TABLE sleep_sessions ADD CONSTRAINT sleep_no_overlap EXCLUDE USING gist (user_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&);
--> statement-breakpoint
ALTER TABLE study_sessions ADD CONSTRAINT study_no_overlap EXCLUDE USING gist (user_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&);
--> statement-breakpoint
CREATE TRIGGER sleep_updated_at BEFORE UPDATE ON sleep_sessions FOR EACH ROW EXECUTE FUNCTION touch_life_resource_updated_at();
--> statement-breakpoint
CREATE TRIGGER study_updated_at BEFORE UPDATE ON study_sessions FOR EACH ROW EXECUTE FUNCTION touch_life_resource_updated_at();
--> statement-breakpoint
CREATE TRIGGER examinations_updated_at BEFORE UPDATE ON examinations FOR EACH ROW EXECUTE FUNCTION touch_life_resource_updated_at();
