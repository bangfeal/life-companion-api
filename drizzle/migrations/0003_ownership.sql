CREATE INDEX "habits_goal_owner_idx" ON "habits" USING btree ("goal_id","user_id");--> statement-breakpoint
CREATE INDEX "events_task_owner_idx" ON "schedule_events" USING btree ("task_id","user_id");--> statement-breakpoint
CREATE INDEX "events_owner_start_idx" ON "schedule_events" USING btree ("user_id","starts_at","id");--> statement-breakpoint
CREATE INDEX "tasks_goal_owner_idx" ON "tasks" USING btree ("goal_id","user_id");--> statement-breakpoint
CREATE INDEX "tasks_owner_due_idx" ON "tasks" USING btree ("user_id","due_at","id");--> statement-breakpoint
-- Cross-module relationships are explicit SQL contracts. Modules never import
-- another module's private table/repository just to declare a foreign key.
ALTER TABLE goals ADD CONSTRAINT goals_owner_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE habits ADD CONSTRAINT habits_owner_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE tasks ADD CONSTRAINT tasks_owner_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE schedule_events ADD CONSTRAINT events_owner_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE habits ADD CONSTRAINT habits_owned_goal_fk FOREIGN KEY (goal_id,user_id) REFERENCES goals(id,user_id) ON DELETE SET NULL (goal_id);
--> statement-breakpoint
ALTER TABLE tasks ADD CONSTRAINT tasks_owned_goal_fk FOREIGN KEY (goal_id,user_id) REFERENCES goals(id,user_id) ON DELETE SET NULL (goal_id);
--> statement-breakpoint
ALTER TABLE schedule_events ADD CONSTRAINT events_owned_task_fk FOREIGN KEY (task_id,user_id) REFERENCES tasks(id,user_id) ON DELETE SET NULL (task_id);
--> statement-breakpoint
-- Also stamp FK-driven detachment, which bypasses application PATCH operations.
CREATE FUNCTION touch_life_resource_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION touch_life_resource_updated_at();
--> statement-breakpoint
CREATE TRIGGER habits_updated_at BEFORE UPDATE ON habits FOR EACH ROW EXECUTE FUNCTION touch_life_resource_updated_at();
--> statement-breakpoint
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION touch_life_resource_updated_at();
--> statement-breakpoint
CREATE TRIGGER events_updated_at BEFORE UPDATE ON schedule_events FOR EACH ROW EXECUTE FUNCTION touch_life_resource_updated_at();
