import {
  bigint,
  boolean,
  char,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// Drizzle schema for MySQL. Kept in sync with db/schema.sql (the plain-SQL
// init script run once against a fresh database).

const id = () =>
  char("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const users = mysqlTable("users", {
  id: id(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).notNull().default("user"),
  status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const passwordResets = mysqlTable("password_resets", {
  id: id(),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A user's gallery: the actual image bytes live in S3 (s3Key); this row is the
// durable, cross-device record. `src` is never stored here (no base64 bloat).
export const gallery = mysqlTable("gallery", {
  id: id(),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  s3Key: varchar("s3_key", { length: 500 }).notNull(),
  s3Url: varchar("s3_url", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull().default(0),
  width: int("width").notNull().default(0),
  height: int("height").notNull().default(0),
  dpi: int("dpi"),
  bgRemoved: boolean("bg_removed").notNull().default(false),
  upscaled: boolean("upscaled").notNull().default(false),
  cropped: boolean("cropped").notNull().default(false),
  textRemoved: boolean("text_removed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exportHistory = mysqlTable("export_history", {
  id: id(),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orderId: varchar("order_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  format: mysqlEnum("format", ["png", "pdf"]).notNull(),
  dpi: int("dpi").notNull(),
  includeBackground: boolean("include_background").notNull().default(false),
  cropMarks: boolean("crop_marks").notNull().default(false),
  includeBleed: boolean("include_bleed").notNull().default(false),
  widthIn: decimal("width_in", { precision: 6, scale: 2 }).notNull().default("22.5"),
  heights: json("heights").notNull().$type<number[]>(),
  itemCount: int("item_count").notNull().default(0),
  sheetCount: int("sheet_count").notNull().default(0),
  // immutable S3 prefix holding the exact exported files for this order
  storagePrefix: varchar("storage_prefix", { length: 500 }),
  snapshot: json("snapshot").notNull().$type<unknown[]>(),
});

export type UserRow = typeof users.$inferSelect;
export type GalleryRow = typeof gallery.$inferSelect;
export type ExportRow = typeof exportHistory.$inferSelect;
