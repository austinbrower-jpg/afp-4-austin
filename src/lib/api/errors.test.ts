import { describe, expect, it } from "vitest";
import { DataProviderError } from "@/lib/data/provider-types";
import { formatApiError } from "./errors";
describe("formatApiError", () => { it("formats provider and generic errors consistently", () => { expect(formatApiError(new DataProviderError("Nope","schema",422,["missing"]))).toEqual({ status:422, body:{ error:"Nope", code:"schema", details:["missing"] } }); expect(formatApiError(new Error("boom"))).toMatchObject({ status:500, body:{ code:"unexpected", error:"boom" } }); }); });
