import type { SessionInfo, DeviceInfo } from "@clawd-relay/types";

interface Props {
  device: DeviceInfo;
  session: SessionInfo;
}

const STATE_TAGS: Record<string, string> = {
  working: "tag-working",
  thinking: "tag-thinking",
  idle: "tag-idle",
  error: "tag-error",
  notification: "tag-notification",
  sleeping: "tag-sleeping",
  attention: "tag-attention",
  running: "tag-running",
};

const STATE_DOTS: Record<string, string> = {
  working: "dot-working",
  thinking: "dot-thinking pulse-thinking",
  idle: "dot-idle",
  error: "dot-error pulse-error",
  notification: "dot-notification",
  sleeping: "dot-sleeping",
  attention: "dot-attention",
  running: "dot-running",
};

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function cwdTail(s: string | null): string {
  if (!s) return "";
  const p = s.split("/");
  return p.length <= 3 ? s : "…/" + p.slice(-3).join("/");
}

export function SessionCard({ session }: Props) {
  const tagClass = STATE_TAGS[session.state] ?? "tag-idle";
  const dotClass = STATE_DOTS[session.state] ?? "dot-idle";
  const inputStr = session.toolInput
    ? JSON.stringify(session.toolInput).slice(0, 120)
    : "";

  return (
    <div class="flex flex-col py-2.5">
      {/* Line 1: state tag + title */}
      <div class="flex items-start gap-3">
        <div class={`flex items-center gap-1 shrink-0 w-[80px] ${tagClass}`}>
          <span class={`dot ${dotClass}`} />
          <span class="text-mono-xs uppercase tracking-wider">{session.state}</span>
        </div>
        <span class="text-mono-sm text-zinc-200 truncate leading-snug">
          {session.title ? truncate(session.title, 100) : <span class="text-zinc-600">—</span>}
        </span>
      </div>

      {/* Line 2: agent + model + tool */}
      <div class="flex items-center gap-3 mt-1.5 text-mono-xs text-zinc-600">
        <span>{session.agentId}</span>
        {session.model && <span>{session.model}</span>}
        {session.toolName && <span class="text-amber-500/70">{session.toolName}</span>}
        {inputStr && <span class="truncate text-zinc-600">{truncate(inputStr, 100)}</span>}
      </div>

      {/* Line 3: cwd */}
      {session.cwd && (
        <div class="text-mono-xs text-zinc-700 truncate mt-0.5" title={session.cwd}>
          {cwdTail(session.cwd)}
        </div>
      )}
    </div>
  );
}
