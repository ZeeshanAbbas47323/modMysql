# AWS deployment checklist — Gangsheet Builder

Stack: Next.js app (any Node host) · **MySQL 8+** (managed or self-hosted) · **S3** (private, presigned).

## 1. Database (one-time)
Run the schema against your MySQL server:
```bash
mysql -h <DB_HOST> -u <DB_USER> -p < db/schema.sql
```
This creates the `gangsheet` database and all tables. Promote the first admin
after they sign up:
```sql
UPDATE gangsheet.users SET role = 'admin' WHERE email = 'you@example.com';
```
Or list their email in `ADMIN_EMAILS` (see below) to grant admin access
immediately, without touching the database.

## 2. S3 bucket
Create a private bucket and attach `aws/iam-policy.json` (fill in
`YOUR_BUCKET_NAME`) to either an IAM user (paired with `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` env vars) or the EC2/ECS instance role (no static
keys needed — the AWS SDK picks up the role automatically).

### CORS (required — exports break without it)
```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET_NAME \
  --cors-configuration file://aws/s3-cors.json
```
Edit `AllowedOrigins` in `aws/s3-cors.json` to your real domain first.

## 3. Environment (see .env.example)
```
AWS_REGION=us-east-1
AWS_BUCKET_NAME=YOUR_BUCKET_NAME
AWS_ACCESS_KEY_ID=...            # omit if using an instance role
AWS_SECRET_ACCESS_KEY=...        # omit if using an instance role

DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=gangsheet_app
DB_PASSWORD=...
DB_NAME=gangsheet

AUTH_SECRET=<64+ random hex>     # already generated into .env.local
ADMIN_EMAILS=you@example.com
```

## 4. Verify
```
GET /api/health/db   ->   { "db": true, "s3Configured": true }
```

## Local development
Run MySQL locally (Laragon, Docker, or a native install) and point `DB_HOST`
/ `DB_USER` / `DB_PASSWORD` / `DB_NAME` at it, then run `db/schema.sql`
against it once.
