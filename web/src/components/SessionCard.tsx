import { AGENT_META } from "@clawd-relay/types";
import type { SessionInfo, DeviceInfo } from "@clawd-relay/types";

interface Props {
  device: DeviceInfo;
  session: SessionInfo;
}

const STATE_COLORS: Record<string, string> = {
  working: "border-l-green-500",
  thinking: "border-l-yellow-500",
  idle: "border-l-zinc-600",
  error: "border-l-red-500",
  notification: "border-l-blue-500",
  sleeping: "border-l-purple-500",
};

const STATE_DOTS: Record<string, string> = {
  working: "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]",
  thinking: "bg-yellow-500 animate-breathe shadow-[0_0_6px_rgba(234,179,8,0.4)]",
  idle: "bg-zinc-500",
  error: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
  notification: "bg-blue-500",
  sleeping: "bg-purple-400",
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
  const stateClass = STATE_COLORS[session.state] ?? "border-l-zinc-600";
  const dotClass = STATE_DOTS[session.state] ?? "bg-zinc-500";
  const inputStr = session.toolInput
    ? JSON.stringify(session.toolInput).slice(0, 80)
    : "";

  return (
    <div class={`bg-zinc-900/80 rounded-xl border border-zinc-800/80 border-l-4 ${stateClass} p-3 md:p-4 space-y-2 card-raise`}>
      {/* Header: agent icon + name, status dot + label */}
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="flex-shrink-0 text-sm leading-none" title={agent?.label ?? session.agentId}>
            {agent?.icon ?? "❓"}
          </span>
          <span class="text-xs font-medium text-zinc-400 truncate">
            {agent?.label ?? session.agentId}
          </span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${dotClass}`} />
          <span class="text-xs text-zinc-500 capitalize">{session.state}</span>
        </div>
      </div>

      {/* Title */}
      {session.title && (
        <p class="text-sm font-medium text-zinc-100 truncate leading-snug">
          {truncate(session.title, 80)}
        </p>
      )}

      {/* Model badge */}
      {session.model && (
        <span class="inline-block text-[11px] text-zinc-600 font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded-md">
          {session.model}
        </span>
      )}

      {/* Tool info */}
      {(session.toolName || inputStr) && (
        <div class="flex items-start gap-1.5 text-xs text-zinc-400 font-mono">
          {session.toolName && (
            <span class="text-indigo-400 shrink-0 mt-[1px] font-medium">{session.toolName}</span>
          )}
          {inputStr && (
            <span class="truncate text-zinc-500 leading-relaxed">{truncate(inputStr, 80)}</span>
          )}
        </div>
      )}

      {/* CWD */}
      {session.cwd && (
        <div class="flex items-center">
          <span class="text-[11px] text-zinc-600 font-mono truncate" title={session.cwd}>
            {cwdTail(session.cwd)}
          </span>
        </div>
      )}
    </div>
  );
}
