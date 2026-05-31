/**
 * Admin console HTML template for Clawd Relay.
 *
 * Generates a self-contained admin page with:
 * - Login form (ADMIN_SECRET input → sessionStorage)
 * - Token list with device online status
 * - Create token form
 * - Revoke button per token
 * No external CDN dependencies.
 */

export function renderAdminConsole(): string {
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Clawd Relay — Admin Console</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
.container { max-width: 960px; margin: 0 auto; padding: 24px; }
h1 { font-size: 1.5rem; margin-bottom: 24px; color: #f8fafc; }
h2 { font-size: 1.125rem; margin: 20px 0 12px; color: #cbd5e1; }
.card { background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #334155; }
.form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
input, button { padding: 8px 12px; border-radius: 6px; border: 1px solid #475569; font-size: 0.875rem; }
input { background: #0f172a; color: #e2e8f0; flex: 1; min-width: 200px; }
input:focus { outline: none; border-color: #3b82f6; }
button { cursor: pointer; transition: background 0.15s; }
.btn-primary { background: #3b82f6; color: #fff; border: none; }
.btn-primary:hover { background: #2563eb; }
.btn-danger { background: #ef4444; color: #fff; border: none; }
.btn-danger:hover { background: #dc2626; }
.btn-secondary { background: #334155; color: #e2e8f0; border: 1px solid #475569; }
.btn-secondary:hover { background: #475569; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #334155; font-size: 0.875rem; }
th { color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
.status-online { color: #22c55e; font-weight: 600; }
.status-offline { color: #64748b; }
.error { color: #ef4444; font-size: 0.875rem; margin-top: 8px; }
.success { color: #22c55e; font-size: 0.875rem; margin-top: 8px; }
.overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat-card { background: #0f172a; border-radius: 6px; padding: 12px; text-align: center; border: 1px solid #334155; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: #f8fafc; }
.stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin-top: 4px; }
#login-form { display: flex; gap: 12px; align-items: center; }
</style>
</head>
<body>
<div class="container">
	<h1>🔗 Clawd Relay — Admin Console</h1>
	<div id="login-section">
		<div class="card">
			<h2>Login</h2>
			<div id="login-form">
				<input type="password" id="admin-secret-input" placeholder="Enter ADMIN_SECRET" />
				<button class="btn-primary" onclick="login()">Unlock</button>
			</div>
		</div>
	</div>
	<div id="app-section" style="display:none;">
		<div class="overview-grid" id="overview"></div>
		<div class="card">
			<h2>Create Token</h2>
			<div class="form-row">
				<input type="text" id="token-label" placeholder="Label (e.g. desktop)" />
				<input type="number" id="token-expiry" placeholder="Expiry (days, optional)" style="max-width:160px;" />
				<button class="btn-primary" onclick="createToken()">Create</button>
			</div>
			<div id="create-result"></div>
		</div>
		<div class="card">
			<h2>Tokens</h2>
			<div id="token-list"><p style="color:#64748b;">No tokens found.</p></div>
		</div>
	</div>
</div>
<script>
let ADMIN_SECRET = "";

function getAuth() { return "Bearer " + ADMIN_SECRET; }

function login() {
	const input = document.getElementById("admin-secret-input");
	ADMIN_SECRET = input.value;
	sessionStorage.setItem("admin_secret", ADMIN_SECRET);
	document.getElementById("login-section").style.display = "none";
	document.getElementById("app-section").style.display = "block";
	loadTokens();
}

(function() {
	const saved = sessionStorage.getItem("admin_secret");
	if (saved) {
		ADMIN_SECRET = saved;
		document.getElementById("login-section").style.display = "none";
		document.getElementById("app-section").style.display = "block";
		loadTokens();
	}
})();

async function api(path, opts = {}) {
	const res = await fetch(path, {
		...opts,
		headers: { ...opts.headers, "Authorization": getAuth(), "Content-Type": "application/json" },
	});
	if (res.status === 403 || res.status === 503) {
		ADMIN_SECRET = "";
		sessionStorage.removeItem("admin_secret");
		document.getElementById("login-section").style.display = "block";
		document.getElementById("app-section").style.display = "none";
		alert("Session expired or invalid secret. Please login again.");
		return null;
	}
	return res;
}

async function loadTokens() {
	try {
		const res = await api("/admin/tokens");
		if (!res) return;
		const data = await res.json();
		renderTokens(data.tokens || [], data.bridgeStatus || {});
		renderOverview(data.tokens || [], data.bridgeStatus || {});
	} catch (e) {
		document.getElementById("token-list").innerHTML = '<p class="error">Failed to load tokens.</p>';
	}
}

function renderTokens(tokens, status) {
	const el = document.getElementById("token-list");
	if (!tokens.length) {
		el.innerHTML = '<p style="color:#64748b;">No tokens found.</p>';
		return;
	}
	let html = '<table><thead><tr><th>ID</th><th>Label</th><th>Created</th><th>Expires</th><th>Status</th><th>Action</th></tr></thead><tbody>';
	for (const t of tokens) {
		const online = status[t.id];
		html += '<tr>' +
			'<td><code>' + esc(t.id.slice(0, 8)) + '…</code></td>' +
			'<td>' + esc(t.label) + '</td>' +
			'<td>' + (t.createdAt ? new Date(t.createdAt).toLocaleString() : '-') + '</td>' +
			'<td>' + (t.expiresAt ? new Date(t.expiresAt).toLocaleString() : '-') + '</td>' +
			'<td class="' + (online ? 'status-online' : 'status-offline') + '">' + (online ? 'Online' : 'Offline') + '</td>' +
			'<td><button class="btn-danger" onclick="revokeToken(\\'' + t.id + '\\')">Revoke</button></td>' +
			'</tr>';
	}
	html += '</tbody></table>';
	el.innerHTML = html;
}

function renderOverview(tokens, status) {
	const el = document.getElementById("overview");
	let online = 0;
	for (const id in status) { if (status[id]) online++; }
	el.innerHTML =
		'<div class="stat-card"><div class="stat-value">' + tokens.length + '</div><div class="stat-label">Tokens</div></div>' +
		'<div class="stat-card"><div class="stat-value">' + online + '</div><div class="stat-label">Online</div></div>' +
		'<div class="stat-card"><div class="stat-value">' + Object.keys(status).length + '</div><div class="stat-label">Active Rooms</div></div>';
}

async function createToken() {
	const label = document.getElementById("token-label").value;
	const expiry = document.getElementById("token-expiry").value;
	const result = document.getElementById("create-result");
	try {
		const body = { label };
		if (expiry) body.expiresInDays = parseInt(expiry);
		const res = await api("/admin/token", { method: "POST", body: JSON.stringify(body) });
		if (!res) return;
		const data = await res.json();
		result.innerHTML = '<p class="success">Token created: <code>' + data.token + '</code></p>';
		document.getElementById("token-label").value = "";
		document.getElementById("token-expiry").value = "";
		loadTokens();
	} catch (e) {
		result.innerHTML = '<p class="error">Failed to create token.</p>';
	}
}

async function revokeToken(id) {
	if (!confirm("Revoke token " + id.slice(0, 8) + "…? This cannot be undone.")) return;
	try {
		await api("/admin/token/" + id, { method: "DELETE" });
		loadTokens();
	} catch (e) {
		alert("Failed to revoke token.");
	}
}

function esc(s) {
	const d = document.createElement("div");
	d.textContent = s || "";
	return d.innerHTML;
}
</script>
</body>
</html>`;
}
