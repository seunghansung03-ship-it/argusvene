import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { env } from "./env";

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
});

export const db = drizzle(pool, { schema });
