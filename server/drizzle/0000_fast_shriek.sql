CREATE TYPE "public"."match_status" AS ENUM('pending', 'mutual', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('candidate', 'hr');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initiator_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"shared_keywords" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"role" "user_role" NOT NULL,
	"job_title" varchar(100),
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_initiator_idx" ON "matches" USING btree ("initiator_id");--> statement-breakpoint
CREATE INDEX "matches_receiver_idx" ON "matches" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "matches_expires_idx" ON "matches" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_keywords_idx" ON "users" USING btree ("keywords");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_expires_idx" ON "users" USING btree ("expires_at");