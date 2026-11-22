BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
CREATE TABLE IF NOT EXISTS user_addresses(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users,recipient text NOT NULL,phone text NOT NULL,address text NOT NULL);
CREATE TABLE IF NOT EXISTS size_options(id text PRIMARY KEY,capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 18),fee integer NOT NULL CHECK(fee>=0));
INSERT INTO size_options VALUES ('S',5,0),('M',10,3000),('L',18,6000) ON CONFLICT DO NOTHING;
ALTER TABLE catalog ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE bouquet_designs ADD COLUMN IF NOT EXISTS ribbon text REFERENCES catalog;
CREATE TABLE IF NOT EXISTS inventory_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,item_id text NOT NULL,delta integer NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION moff_log_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.stock <> OLD.stock THEN INSERT INTO inventory_logs(item_id,delta) VALUES(NEW.id,NEW.stock-OLD.stock); END IF; RETURN NEW; END $$;
CREATE OR REPLACE TRIGGER moff_inventory AFTER UPDATE OF stock ON catalog FOR EACH ROW EXECUTE FUNCTION moff_log_stock();
CREATE TABLE IF NOT EXISTS order_status_history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id uuid NOT NULL REFERENCES orders ON DELETE CASCADE,status text NOT NULL,changed_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION moff_log_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO order_status_history(order_id,status) VALUES(NEW.id,NEW.status); RETURN NEW; END $$;
CREATE OR REPLACE TRIGGER moff_order_history AFTER INSERT OR UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION moff_log_order();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text;
CREATE TABLE IF NOT EXISTS faq_items(id uuid PRIMARY KEY,category text NOT NULL,question text NOT NULL,answer text NOT NULL);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS private boolean NOT NULL DEFAULT true;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders;
CREATE INDEX IF NOT EXISTS design_owner_idx ON bouquet_designs(owner_id);
CREATE INDEX IF NOT EXISTS element_design_idx ON design_elements(design_id);
CREATE INDEX IF NOT EXISTS cart_owner_idx ON cart_items(owner_id);
CREATE INDEX IF NOT EXISTS order_owner_date_idx ON orders(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS order_item_order_idx ON order_items(order_id);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject text UNIQUE;
COMMIT;
