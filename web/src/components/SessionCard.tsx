import { AGENT_META } from "@clawd-relay/types";
import type { SessionInfo, DeviceInfo } from "@clawd-relay/types";

interface Props {
  device: DeviceInfo;
  session: SessionInfo;
}

const STATE_BORDER: Record<string, string> = {
  working: "border-l-green-500/70",
  thinking: "border-l-yellow-500/70",
  idle: "border-l-zinc-600/40",
  error: "border-l-red-500/70",
  notification: "border-l-blue-500/70",
  sleeping: "border-l-purple-500/70",
};

const STATE_DOTS: Record<string, string> = {
  working: "bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]",
  thinking: "bg-yellow-400 animate-breathe shadow-[0_0_8px_rgba(234,179,8,0.4)]",
  idle: "bg-zinc-500",
  error: "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
  notification: "bg-blue-400",
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
  const borderClass = STATE_BORDER[session.state] ?? "border-l-zinc-600/40";
  const dotClass = STATE_DOTS[session.state] ?? "bg-zinc-500";
  const agentColor = agent?.color ?? "#6B7280";
  const inputStr = session.toolInput
    ? JSON.stringify(session.toolInput).slice(0, 100)
    : "";

  return (
    <div
      class={`card-glow rounded-xl bg-zinc-900/50 border border-zinc-800/50 border-l-[3px] ${borderClass} p-3 md:p-4`}
      style={{ "--glow-color": agentColor } as any}
    >
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
          <span class={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
          <span class="text-[11px] text-zinc-500 capitalize font-medium">{session.state}</span>
        </div>
      </div>

      {/* Title */}
      {session.title && (
        <p class="text-sm font-medium text-zinc-100 truncate leading-snug mb-1.5">
          {truncate(session.title, 80)}
        </p>
      )}

      {/* Meta row: model + tool */}
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

      {/* Tool input */}
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
        ) : <span />}
        <span class="text-[10px] text-zinc-600 font-mono">{session.id.slice(0, 8)}</span>
      </div>
    </div>
  );
}
