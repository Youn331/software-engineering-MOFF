BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'CUSTOMER',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS session_expire_idx ON session(expire);

CREATE TABLE IF NOT EXISTS catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  price integer NOT NULL CHECK(price>=0),
  stock integer NOT NULL CHECK(stock>=0),
  image text NOT NULL
);

CREATE TABLE IF NOT EXISTS bouquet_designs (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  size text NOT NULL,
  wrapping text NOT NULL REFERENCES catalog(id),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS design_elements (
  id uuid PRIMARY KEY,
  design_id uuid NOT NULL REFERENCES bouquet_designs(id) ON DELETE CASCADE,
  catalog_id text NOT NULL REFERENCES catalog(id),
  x real NOT NULL,
  y real NOT NULL,
  length real NOT NULL,
  rotation real NOT NULL,
  layer integer NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  snapshot jsonb NOT NULL,
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 20)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  request_key uuid NOT NULL,
  status text NOT NULL,
  total integer NOT NULL,
  shipping integer NOT NULL,
  address jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id,request_key)
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  snapshot jsonb NOT NULL,
  quantity integer NOT NULL,
  unit_price integer NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  order_id uuid UNIQUE NOT NULL REFERENCES orders(id),
  method text NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL
);

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  body text NOT NULL,
  answer text,
  created_at timestamptz DEFAULT now()
);

COMMIT;
