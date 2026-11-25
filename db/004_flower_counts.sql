BEGIN;
ALTER TABLE size_options ADD COLUMN IF NOT EXISTS min_flowers integer NOT NULL
  DEFAULT 1 CHECK (min_flowers BETWEEN 1 AND capacity);
WITH first_run AS (
  INSERT INTO schema_migrations (id) VALUES ('004_flower_counts')
  ON CONFLICT DO NOTHING RETURNING id
)
UPDATE size_options AS s SET min_flowers = limits.low, capacity = limits.high
FROM (VALUES ('S', 1, 1), ('M', 2, 6), ('L', 7, 12)) AS limits(id, low, high)
WHERE s.id = limits.id AND EXISTS (SELECT 1 FROM first_run);
COMMIT;
