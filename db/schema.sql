-- Gangsheet Builder — MySQL schema (start-fresh).
-- Run once against a MySQL 8+ server:
--   mysql -u root -p < db/schema.sql
-- Idempotent: safe to re-run.

CREATE DATABASE IF NOT EXISTS gangsheet
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gangsheet;

-- Users (custom email+password auth; password_hash is a bcrypt hash) ----------
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(320) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('user','admin')      NOT NULL DEFAULT 'user',
  status        ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY users_email_uk (email)
) ENGINE=InnoDB;

-- Password reset tokens (token is hashed at rest; never store it raw) ---------
CREATE TABLE IF NOT EXISTS password_resets (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_resets_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  KEY password_resets_user_idx (user_id)
) ENGINE=InnoDB;

-- Gallery: each uploaded image belongs to a user. Bytes live in S3 at s3_key;
-- this row is the durable, cross-device record.
CREATE TABLE IF NOT EXISTS gallery (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  user_id       CHAR(36)     NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  s3_key        VARCHAR(500) NOT NULL,
  s3_url        VARCHAR(1000) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  file_size     BIGINT       NOT NULL DEFAULT 0,
  width         INT          NOT NULL DEFAULT 0,
  height        INT          NOT NULL DEFAULT 0,
  dpi           INT          NULL,
  bg_removed    BOOLEAN      NOT NULL DEFAULT FALSE,
  upscaled      BOOLEAN      NOT NULL DEFAULT FALSE,
  cropped       BOOLEAN      NOT NULL DEFAULT FALSE,
  text_removed  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT gallery_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  KEY gallery_user_created_idx (user_id, created_at DESC)
) ENGINE=InnoDB;

-- Export history (one row per export, with a unique Order ID) -----------------
CREATE TABLE IF NOT EXISTS export_history (
  id                 CHAR(36)     NOT NULL PRIMARY KEY,
  user_id            CHAR(36)     NOT NULL,
  order_id           VARCHAR(64)  NOT NULL,
  name               VARCHAR(255) NOT NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  format             ENUM('png','pdf') NOT NULL,
  dpi                INT          NOT NULL,
  include_background BOOLEAN      NOT NULL DEFAULT FALSE,
  crop_marks         BOOLEAN      NOT NULL DEFAULT FALSE,
  include_bleed      BOOLEAN      NOT NULL DEFAULT FALSE,
  width_in           DECIMAL(6,2) NOT NULL DEFAULT 22.5,
  heights            JSON         NOT NULL,
  item_count         INT          NOT NULL DEFAULT 0,
  sheet_count        INT          NOT NULL DEFAULT 0,
  storage_prefix     VARCHAR(500) NULL,     -- immutable S3 prefix of the exact files
  snapshot           JSON         NOT NULL,
  CONSTRAINT export_history_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE KEY export_history_order_uk (order_id),
  KEY export_history_user_created_idx (user_id, created_at DESC)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Bootstrap admin: promote a user to admin manually (after they sign up) with:
--   UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
-- Or list an email in ADMIN_EMAILS (see .env.example) to grant admin access
-- without a DB row — useful before the account exists.
-- ---------------------------------------------------------------------------
