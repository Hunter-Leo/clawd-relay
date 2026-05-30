/**
 * Worker-specific types for Clawd Relay CF Worker.
 *
 * These types extend the shared protocol (@clawd-relay/types) with
 * Durable Object storage schemas and Admin API contracts.
 */

/** Token record persisted in DO storage. */
export interface TokenRecord {
	id: string;
	label: string;
	createdAt: number; // epoch ms
	expiresAt?: number; // epoch ms, optional
	revoked?: boolean;
}

/** Admin API request body for creating a new token. */
export interface AdminTokenRequest {
	label: string;
	expiresInDays?: number;
}

/** Admin API response for listing all tokens. */
export interface AdminTokenListResponse {
	tokens: TokenRecord[];
	bridgeStatus: Record<string, boolean>; // tokenId → online
}

/** Worker environment bindings. */
export interface Env {
	RELAY_ROOM: DurableObjectNamespace;
	ADMIN_SECRET: string;
}

/** DO storage key constants. */
export const STORAGE_KEYS = {
	tokenPrefix: "token:",
	tokenIds: "token_ids",
} as const;
