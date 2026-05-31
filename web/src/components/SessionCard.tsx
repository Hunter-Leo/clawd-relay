import { AGENT_META } from "@clawd-relay/types";
import type { SessionInfo, DeviceInfo } from "@clawd-relay/types";

interface Props {
  device: DeviceInfo;
  session: SessionInfo;
}

const STATE_COLORS: Record<string, string> = {
  working: "bg-green-500",
  thinking: "bg-yellow-500",
  idle: "bg-zinc-500",
  error: "bg-red-500",
  notification: "bg-blue-500",
  sleeping: "bg-purple-500",
};

const STATE_GLOWS: Record<string, string> = {
  working: "shadow-[0_0_8px_rgba(34,197,94,0.5)]",
  thinking: "shadow-[0_0_8px_rgba(234,179,8,0.4)]",
  error: "shadow-[0_0_8px_rgba(239,68,68,0.5)]",
};

function truncate(str: string | null, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function cwdTail(cwd: string | null): string {
  if (!cwd) return "";
  const parts = cwd.split("/");
  if (parts.length <= 3) return cwd;
  return "…/" + parts.slice(-3).join("/");
}

export function SessionCard({ device, session }: Props) {
  const agent = AGENT_META[session.agentId];
  const stateColor = STATE_COLORS[session.state] ?? "bg-zinc-500";
  const stateGlow = STATE_GLOWS[session.state] ?? "";
  const inputStr = session.toolInput
    ? JSON.stringify(session.toolInput).slice(0, 100)
    : "";

  return (
    <div class="card-glow rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-3 md:p-4 relative overflow-hidden">
      {/* Top state indicator bar */}
      <div class={`absolute top-0 left-0 right-0 h-0.5 ${stateColor} ${stateGlow}`} />

      {/* Header row */}
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="flex-shrink-0 text-sm leading-none" title={agent?.label ?? session.agentId}>
            {agent?.icon ?? "?"}
          </span>
          <span class="text-[11px] font-medium text-zinc-500 truncate uppercase tracking-wider">
            {agent?.label ?? session.agentId}
          </span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class={`w-1.5 h-1.5 rounded-full ${stateColor}`} />
          <span class="text-[11px] text-zinc-500 capitalize font-medium">{session.state}</span>
        </div>
      </div>

      {/* Title */}
      {session.title && (
        <p class="text-sm font-medium text-zinc-100 truncate leading-snug mb-1.5">
          {truncate(session.title, 80)}
        </p>
      )}

      {/* Tags row */}
      <div class="flex items-center gap-2 flex-wrap">
        {session.model && (
          <span class="text-[11px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded-md font-mono">
            {session.model}
          </span>
        )}
        {session.toolName && (
          <span class="text-[11px] text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded-md font-mono font-medium">
            {session.toolName}
          </span>
        )}
      </div>

      {/* Tool input block */}
      {inputStr && (
        <div class="mt-1.5 text-[11px] text-zinc-600 font-mono truncate bg-zinc-950/40 rounded-lg px-2 py-1 border border-zinc-800/30">
          {truncate(inputStr, 80)}
        </div>
      )}

      {/* Footer */}
      <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-800/30">
        {session.cwd ? (
          <span class="text-[10px] text-zinc-600 font-mono truncate" title={session.cwd}>
            {cwdTail(session.cwd)}
          </span>
        ) : null}
        <span class="text-[10px] text-zinc-600 font-mono">{session.id.slice(0, 8)}</span>
      </div>
    </div>
  );
}
