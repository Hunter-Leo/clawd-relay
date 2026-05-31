import type { DeviceState } from "../state/store";
import { SessionCard } from "./SessionCard";

interface Props {
  device: DeviceState;
}

export function DeviceGroup({ device }: Props) {
  const { info, sessions, online } = device;
  const count = sessions.length;

  return (
    <section>
      {/* Device header */}
      <div class="flex items-center gap-3 py-2 border-b border-zinc-800">
        <div class="flex items-center gap-2 min-w-0">
          <span class={`inline-block w-[7px] h-[7px] flex-shrink-0 ${online ? "dot-online" : "dot-offline"}`} />
          <span class="text-mono-title text-zinc-200 truncate">{info.host}</span>
          <span class="text-mono-xs text-zinc-600">{info.platform}</span>
        </div>
        <div class="flex items-center gap-2 ml-auto shrink-0 text-mono-xs">
          <span class={online ? "text-green-500/70" : "text-zinc-600"}>
            {online ? "[online]" : "[offline]"}
          </span>
          {count > 0 && (
            <span class="text-zinc-600">{count} session{count > 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div class="divide-y divide-zinc-800/50">
          {sessions.map((s) => (
            <div key={s.id} class="pl-[18px]">
              <SessionCard device={info} session={s} />
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <div class="text-mono-xs text-zinc-700 text-center py-4">
          no active sessions
        </div>
      )}
    </section>
  );
}
