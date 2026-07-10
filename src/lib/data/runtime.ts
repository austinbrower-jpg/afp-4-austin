import "server-only";
import { assertRuntimeConfig, resolveRuntimeConfig } from "./runtime-config";

export function getRuntimeConfig() {
  return resolveRuntimeConfig(process.env);
}
export function requireValidRuntimeConfig() {
  return assertRuntimeConfig(getRuntimeConfig());
}

export function getAppDataSource() {
  return requireValidRuntimeConfig().mode;
}
