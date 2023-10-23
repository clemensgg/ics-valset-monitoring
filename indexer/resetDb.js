import { deleteAllTables } from "./db/db.js";

await deleteAllTables();
console.log("Database reset, all tables deleted");
