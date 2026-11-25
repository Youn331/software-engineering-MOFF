BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY);
WITH first_run AS (
  INSERT INTO schema_migrations (id) VALUES ('003_size_fees')
  ON CONFLICT DO NOTHING RETURNING id
)
UPDATE size_options AS option
SET fee = prices.fee
FROM (VALUES ('S', 3000), ('M', 6000), ('L', 10000)) AS prices(id, fee)
WHERE option.id = prices.id AND EXISTS (SELECT 1 FROM first_run);
COMMIT;
