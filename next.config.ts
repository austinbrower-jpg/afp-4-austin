import type { NextConfig } from "next";
import { assertRuntimeConfig, resolveRuntimeConfig } from "./src/lib/data/runtime-config";

assertRuntimeConfig(resolveRuntimeConfig(process.env));

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
