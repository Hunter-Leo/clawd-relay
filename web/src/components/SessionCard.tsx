import { AGENT_META } from "@clawd-relay/types";
import type { SessionInfo, DeviceInfo } from "@clawd-relay/types";

interface Props {
  device: DeviceInfo;
  session: SessionInfo;
}

const STATE_COLORS: Record<string, string> = {
  working: "border-l-green-500",
  thinking: "border-l-yellow-500",
  idle: "border-l-zinc-500",
  error: "border-l-red-500",
  notification: "border-l-blue-500",
  sleeping: "border-l-purple-500",
};

const STATE_DOTS: Record<string, string> = {
  working: "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]",
  thinking: "bg-yellow-500 animate-pulse",
  idle: "bg-zinc-500",
  error: "bg-red-500",
  notification: "bg-blue-500",
  sleeping: "bg-purple-500",
};

function stateLabel(state: string): string {
  return `session.state.${state}`;
}

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

function childLabel(count: number): string {
  if (count <= 1) return "session.child_count.one";
  if (count === 2) return "session.child_count.two";
  return "session.child_count.many";
}

export function SessionCard({ device, session }: Props) {
  const agent = AGENT_META[session.agentId];
  const agentColor = agent?.color ?? "#6B7280";
  const stateClass = STATE_COLORS[session.state] ?? "border-l-zinc-600";
  const dotClass = STATE_DOTS[session.state] ?? "bg-zinc-500";
  const inputStr = session.toolInput
    ? JSON.stringify(session.toolInput).slice(0, 80)
    : "";

  return (
    <div class={`bg-zinc-900 rounded-lg border border-zinc-800 border-l-4 ${stateClass} p-3 md:p-4 space-y-2`}>
      {/* Header */}
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="flex-shrink-0 text-sm" title={agent?.label ?? session.agentId}>
            {agent?.icon ?? "❓"}
          </span>
          <span class="text-xs font-medium text-zinc-400 truncate">
            {agent?.label ?? session.agentId}
          </span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
          <span class="text-xs text-zinc-500 capitalize">{session.state}</span>
        </div>
      </div>

      {/* Title */}
      {session.title && (
        <p class="text-sm font-medium text-zinc-100 truncate">
          {truncate(session.title, 80)}
        </p>
      )}

      {/* Model */}
      {session.model && (
        <p class="text-xs text-zinc-500 font-mono truncate">{session.model}</p>
      )}

      {/* Tool info */}
      {(session.toolName || inputStr) && (
        <div class="flex items-center gap-1.5 text-xs text-zinc-400 font-mono truncate">
          {session.toolName && (
            <span class="text-indigo-400 shrink-0">{session.toolName}</span>
          )}
          {inputStr && (
            <span class="truncate text-zinc-500">{truncate(inputStr, 80)}</span>
          )}
        </div>
      )}

      {/* CWD + count */}
      <div class="flex items-center justify-between gap-2">
        {session.cwd && (
          <span class="text-xs text-zinc-600 font-mono truncate" title={session.cwd}>
            {cwdTail(session.cwd)}
          </span>
        )}
        <span class="text-xs text-zinc-600 flex-shrink-0">{childLabel(1)}</span>
      </div>
    </div>
  );
}
