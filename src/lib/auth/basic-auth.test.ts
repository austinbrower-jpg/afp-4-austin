import { describe, expect, it } from "vitest";
import { constantTimeEqual, isBasicAuthorizationValid, parseBasicAuthorization } from "./basic-auth";

describe("private app basic authentication", () => {
  it("parses and validates an exact credential pair", () => {
    const header = `Basic ${btoa("austin:correct horse battery staple")}`;
    expect(parseBasicAuthorization(header)).toEqual({ username: "austin", password: "correct horse battery staple" });
    expect(isBasicAuthorizationValid(header, "austin", "correct horse battery staple")).toBe(true);
  });

  it("rejects missing and incorrect credentials", () => {
    expect(isBasicAuthorizationValid(null, "austin", "secret")).toBe(false);
    expect(isBasicAuthorizationValid(`Basic ${btoa("austin:wrong")}`, "austin", "secret")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});
