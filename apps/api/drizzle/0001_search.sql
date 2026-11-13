-- Recherche plein texte : `search_text` est normalisé par l'application (minuscules, sans accents).
ALTER TABLE "submissions" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "search_text")) STORED;--> statement-breakpoint
CREATE INDEX "submissions_search_idx" ON "submissions" USING GIN ("search");--> statement-breakpoint
CREATE INDEX "submissions_deleted_idx" ON "submissions" ("deleted_at") WHERE "deleted_at" IS NOT NULL;
