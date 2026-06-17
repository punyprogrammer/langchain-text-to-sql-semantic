# Database Migration Guide — Supabase PostgreSQL

This guide helps you seed a cloud [Supabase](https://supabase.com) Postgres instance with an open-source sample database for building a **text-to-SQL LangChain agent**.

Supabase gives you a managed Postgres database. You do not create separate databases inside a project — you load sample data into **schemas** within the default `postgres` database.

---

## Recommended open-source sample databases

These are widely used for SQL learning, ORM demos, and text-to-SQL benchmarks. All have realistic relationships (foreign keys, joins) that make good agent test cases.

| Database | Tables | Domain | Postgres-native? | Best for | Repo |
|----------|--------|--------|------------------|----------|------|
| **Pagila** (recommended) | ~22 (+ partitions) | DVD rental store | Yes | Balanced complexity, joins, aggregations, date ranges | [devrimgunduz/pagila](https://github.com/devrimgunduz/pagila) |
| **AdventureWorks** | ~68 | Bicycle parts wholesaler (HR, sales, purchasing) | Port available | Complex multi-schema queries, advanced agents | [lorint/AdventureWorks-for-Postgres](https://github.com/lorint/AdventureWorks-for-Postgres) |
| **Chinook** | 11 | Digital music store | Yes | Getting started, simpler agent prompts | [lerocha/chinook-database](https://github.com/lerocha/chinook-database) |
| **Northwind** | 14 | Food import/export trading | Port available | Classic ERP-style CRM queries | [harryho/db-samples](https://github.com/harryho/db-samples) |

### Why Pagila is the default pick

- Native PostgreSQL schema (no SQL Server conversion quirks).
- Familiar domain: films, actors, customers, rentals, payments.
- Enough tables and relationships for non-trivial joins without the overhead of AdventureWorks.
- Single-command seeding via `psql`.
- Includes views and a partitioned `payment` table — useful for testing window functions and date filters.

### When to use the others

- **AdventureWorks** — You want 60+ tables across multiple schemas (`Person`, `Sales`, `HumanResources`, etc.) and harder multi-hop questions.
- **Chinook** — You want a smaller schema to iterate quickly on agent prompts and tool wiring.
- **Northwind** — You want a classic orders/products/suppliers model with moderate complexity.

---

## Prerequisites

1. A [Supabase project](https://supabase.com/dashboard) (free tier is fine).
2. Your database password (Project Settings → Database).
3. One of the following clients:
   - [`psql`](https://www.postgresql.org/download/) (recommended for large seed files)
   - [Supabase CLI](https://supabase.com/docs/guides/cli) (recommended for repeatable migrations)
   - Supabase Dashboard → SQL Editor (fine for small scripts only)

### Get your connection string

In Supabase: **Project Settings → Database → Connection string → URI**

Use the **direct** connection (port `5432`) for migrations and seeding:

```text
postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
```

Or the direct host (IPv6, or IPv4 with add-on):

```text
postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres
```

> Use the **session pooler** (port 5432) or **direct** connection for `psql` and `pg_restore`. Avoid the transaction pooler (port 6543) for migrations.

Store credentials in a local `.env` file (never commit this):

```bash
# backend/.env
SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
SAMPLE_SCHEMA=pagila
```

---

## Supabase-specific notes

| Topic | What to know |
|-------|--------------|
| No `CREATE DATABASE` | Supabase projects expose one database named `postgres`. Use `CREATE SCHEMA` to namespace sample data. |
| Schema isolation | Load each sample DB into its own schema (`pagila`, `chinook`, etc.) so you can keep multiple datasets or drop one cleanly. |
| Extensions | Enable required extensions in **Database → Extensions** or via SQL before seeding (see AdventureWorks below). |
| Timeouts | Large seed files may hit the SQL Editor timeout. Prefer `psql` from your machine. |
| RLS | Sample scripts do not enable Row Level Security. For a read-only agent, connect with a role that has `SELECT` only. |

---

## Quick start: seed Pagila (recommended)

### 1. Clone the sample database repo

```bash
git clone https://github.com/devrimgunduz/pagila.git /tmp/pagila
cd /tmp/pagila
```

### 2. Create a dedicated schema on Supabase

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS pagila;
SET search_path TO pagila, public;
SQL
```

### 3. Load schema and data

Pagila ships two files: `pagila-schema.sql` (DDL) and `pagila-data.sql` (DML).

```bash
export SUPABASE_DB_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Schema (tables, views, functions, partitions)
psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -c "SET search_path TO pagila, public;" \
  -f pagila-schema.sql

# Data
psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -c "SET search_path TO pagila, public;" \
  -f pagila-data.sql
```

If objects land in `public` instead of `pagila`, edit the SQL files once before loading:

```bash
# Prefix all CREATE TABLE / INSERT references with the target schema
sed 's/CREATE TABLE public\./CREATE TABLE pagila./g; s/INSERT INTO public\./INSERT INTO pagila./g' \
  pagila-schema.sql > pagila-schema-pagila.sql
```

### 4. Verify

```bash
psql "$SUPABASE_DB_URL" <<'SQL'
SELECT table_schema, count(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'pagila' AND table_type = 'BASE TABLE'
GROUP BY table_schema;

SELECT f.title, a.first_name, a.last_name
FROM pagila.film f
JOIN pagila.film_actor fa ON f.film_id = fa.film_id
JOIN pagila.actor a ON a.actor_id = fa.actor_id
LIMIT 5;
SQL
```

You should see ~22 base tables and sample film/actor rows.

---

## Seed Chinook (simpler, 11 tables)

```bash
git clone https://github.com/lerocha/chinook-database.git /tmp/chinook-database
cd /tmp/chinook-database

# PostgreSQL script (single file with schema + data)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS chinook;
SET search_path TO chinook, public;
SQL

# The repo path may vary slightly by version; look for:
#   ChinookDatabase/DataSources/Chinook_PostgreSql.sql
psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -c "SET search_path TO chinook, public;" \
  -f ChinookDatabase/DataSources/Chinook_PostgreSql.sql
```

Verify:

```sql
SELECT count(*) FROM chinook."Track";
SELECT "Name", "Composer" FROM chinook."Track" LIMIT 10;
```

> Chinook uses quoted PascalCase table names (`"Album"`, `"Track"`). Your LangChain agent schema introspection must preserve case.

---

## Seed AdventureWorks (advanced, ~68 tables)

### 1. Enable extensions on Supabase

In the SQL Editor or via `psql`:

```sql
CREATE EXTENSION IF NOT EXISTS tablefunc;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

You can also enable these under **Database → Extensions** in the dashboard.

### 2. Clone and load

```bash
git clone https://github.com/ggodreau/adventureworks.git /tmp/adventureworks
cd /tmp/adventureworks

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS adventureworks;
SQL

psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -f install.sql
```

> AdventureWorks creates multiple schemas (`Person`, `Sales`, `HumanResources`, `Production`, `Purchasing`) at the database level — not under a single `adventureworks` schema. That is fine on Supabase; just point your agent at the right schema set.

Verify:

```sql
SELECT schemaname, count(*) AS tables
FROM pg_tables
WHERE schemaname IN ('person', 'sales', 'humanresources', 'production', 'purchasing')
GROUP BY schemaname
ORDER BY schemaname;
```

---

## Seed Northwind (14 tables)

```bash
git clone https://github.com/harryho/db-samples.git /tmp/db-samples
cd /tmp/db-samples/pgsql

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS northwind;
SET search_path TO northwind, public;
SQL

psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -c "SET search_path TO northwind, public;" \
  -f northwind.sql
```

Verify:

```sql
SELECT count(*) FROM northwind.orders;
SELECT company_name FROM northwind.customers LIMIT 10;
```

---

## Repeatable migrations with Supabase CLI (optional)

For version-controlled, repeatable seeds across local and cloud:

### 1. Initialize Supabase in the project root

```bash
cd /path/to/langchain-text-to-sql
supabase init
supabase link --project-ref [your-project-ref]
```

### 2. Add a migration for the schema

```bash
supabase migration new create_pagila_schema
```

Edit the generated file in `supabase/migrations/`:

```sql
CREATE SCHEMA IF NOT EXISTS pagila;
```

### 3. Add seed data

Copy or reference the Pagila SQL files in `supabase/seed.sql`, or split into ordered files and concatenate:

```bash
cat pagila-schema.sql pagila-data.sql > supabase/seed.sql
```

### 4. Push to cloud

```bash
supabase db push
supabase db push --include-seed
```

See [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations) for the full workflow.

---

## Wiring the database to your LangChain text-to-SQL agent

Use a Postgres connection URI and set the schema search path so the agent introspects the right tables.

### Python example

```python
import os
from langchain_community.utilities import SQLDatabase

db = SQLDatabase.from_uri(
    os.environ["SUPABASE_DB_URL"],
    schema=os.environ.get("SAMPLE_SCHEMA", "pagila"),
    include_tables=None,  # all tables in schema
    sample_rows_in_table_info=3,
)

print(db.get_table_info())
```

### Suggested environment variables

```bash
SUPABASE_DB_URL=postgresql://...
SAMPLE_SCHEMA=pagila          # or chinook, northwind
OPENAI_API_KEY=sk-...         # or your LLM provider key
```

### Example natural-language questions to test the agent

**Pagila**
- "Which 5 actors appear in the most films?"
- "What is total revenue by store in 2022?"
- "List customers who have never rented a film."

**Chinook**
- "Top 10 best-selling tracks by total quantity."
- "Which employee generated the most invoice revenue?"

**AdventureWorks**
- "What are the top 10 products by sales in 2013?"
- "How many employees are in each department?"

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `permission denied to create database` | Expected on Supabase. Use `CREATE SCHEMA` instead of `CREATE DATABASE`. |
| `relation already exists` | Drop the schema and retry: `DROP SCHEMA pagila CASCADE; CREATE SCHEMA pagila;` |
| SQL Editor times out | Use `psql` locally with `SUPABASE_DB_URL`. |
| `extension "tablefunc" is not available` | Enable it under Database → Extensions (AdventureWorks). |
| Agent sees wrong tables | Set `schema=` in `SQLDatabase.from_uri` or `SET search_path TO pagila;` on connect. |
| IPv6 connection errors | Use the session pooler URI (IPv4) from the dashboard. |
| Chinook quoted identifiers fail | Ensure the agent preserves `"Album"` / `"Track"` casing in generated SQL. |

---

## Clean up / reset a sample dataset

```sql
-- Replace pagila with chinook, northwind, etc.
DROP SCHEMA IF EXISTS pagila CASCADE;
```

For AdventureWorks (multi-schema):

```sql
DROP SCHEMA IF EXISTS person, humanresources, production, purchasing, sales CASCADE;
```

---

## Recommended path for this project

1. Start with **Pagila** — best balance of realism and complexity for a text-to-SQL agent.
2. Add **Chinook** in a separate schema if you want a simpler fallback for debugging.
3. Graduate to **AdventureWorks** when you need harder multi-schema questions.

## References

- [Pagila (PostgreSQL Sakila)](https://github.com/devrimgunduz/pagila)
- [Chinook Database](https://github.com/lerocha/chinook-database)
- [AdventureWorks for Postgres](https://github.com/lorint/AdventureWorks-for-Postgres)
- [Northwind db-samples](https://github.com/harryho/db-samples)
- [Connect to Supabase Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [LangChain SQLDatabase](https://python.langchain.com/docs/integrations/tools/sql_database/)
