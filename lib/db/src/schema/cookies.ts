import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cookiesTable = pgTable("roblox_cookies", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().unique(),
  cookieValue: text("cookie_value").notNull(),
  status: text("status").notNull().default("active"), // active | invalid | expired
  addedBy: text("added_by").notNull(), // Discord user ID
  lastChecked: timestamp("last_checked", { withTimezone: true }),
  lastRefreshed: timestamp("last_refreshed", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCookieSchema = createInsertSchema(cookiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCookie = z.infer<typeof insertCookieSchema>;
export type Cookie = typeof cookiesTable.$inferSelect;
