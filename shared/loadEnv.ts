import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  const path = resolve(process.cwd(), ".env");
  if (existsSync(path)) config({ path });
  loaded = true;
}
