import { describe, it, expect } from "vitest";
import { STORAGE_KEYS } from "../src/types.js";

describe("types", () => {
	it("should export STORAGE_KEYS constants", () => {
		expect(STORAGE_KEYS.tokenPrefix).toBe("token:");
		expect(STORAGE_KEYS.tokenIds).toBe("token_ids");
	});
});
