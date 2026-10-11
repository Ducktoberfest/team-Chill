-- ChillDesk schema (Neon Postgres + pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS customers (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    phone       text UNIQUE NOT NULL,
    email       text NOT NULL,
    city        text NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    category    text NOT NULL,
    price       numeric(10,2) NOT NULL,
    stock       int NOT NULL,
    warranty_months int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
    id          text PRIMARY KEY,
    customer_id text NOT NULL REFERENCES customers(id),
    status      text NOT NULL,          -- processing | shipped | out_for_delivery | delivered | delayed | cancelled
    total       numeric(10,2) NOT NULL,
    payment     text NOT NULL,
    courier     text,
    tracking_no text,
    address     text NOT NULL,
    created_at  timestamptz NOT NULL,
    eta         date,
    delivered_at timestamptz,
    timeline    jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS order_items (
    order_id    text NOT NULL REFERENCES orders(id),
    product_id  text NOT NULL REFERENCES products(id),
    qty         int NOT NULL,
    price       numeric(10,2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS kb_chunks (
    id          serial PRIMARY KEY,
    doc         text NOT NULL,
    title       text NOT NULL,
    content     text NOT NULL,
    embedding   vector(768) NOT NULL
);

CREATE TABLE IF NOT EXISTS returns (
    id          text PRIMARY KEY,
    order_id    text NOT NULL REFERENCES orders(id),
    product_id  text NOT NULL REFERENCES products(id),
    reason      text NOT NULL,
    photo_assessment text,
    resolution  text NOT NULL,          -- refund | replacement | review
    status      text NOT NULL DEFAULT 'open',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
    id          text PRIMARY KEY,
    channel     text NOT NULL,          -- web | voice
    customer_id text REFERENCES customers(id),
    started_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    ended_at    timestamptz,
    messages    jsonb NOT NULL DEFAULT '[]',
    analysis    jsonb                   -- post-conversation automation output
);

CREATE TABLE IF NOT EXISTS tickets (
    id          text PRIMARY KEY,
    conversation_id text REFERENCES conversations(id),
    customer_id text REFERENCES customers(id),
    order_id    text,
    team        text NOT NULL,
    priority    text NOT NULL,          -- P1 | P2 | P3
    summary     text NOT NULL,
    source      text NOT NULL,          -- agent | automation
    status      text NOT NULL DEFAULT 'open',
    created_at  timestamptz NOT NULL DEFAULT now()
);
