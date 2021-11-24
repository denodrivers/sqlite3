import { Database } from "../src/database.ts";

const db = new Database("test.db");

console.log(db.queryObject("select sqlite_version()"));

db.close();
