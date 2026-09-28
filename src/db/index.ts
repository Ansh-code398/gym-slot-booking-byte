import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

function getDb() {
  if (!connectionString) {
    const fallbackSql = neon(
      "postgresql://placeholder:placeholder@ep-placeholder.region.neon.tech/neondb?sslmode=require"
    );
    return drizzle(fallbackSql, { schema });
  }
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export const db = getDb();
export * from "./schema";
