CREATE TYPE "public"."drawing_kind" AS ENUM('trendline', 'horizontal');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drawings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"timeframe" varchar(5) NOT NULL,
	"kind" "drawing_kind" NOT NULL,
	"x1" bigint NOT NULL,
	"y1" double precision NOT NULL,
	"x2" bigint,
	"y2" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drawings" ADD CONSTRAINT "drawings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawings_lookup_idx" ON "drawings" USING btree ("user_id","symbol","timeframe");