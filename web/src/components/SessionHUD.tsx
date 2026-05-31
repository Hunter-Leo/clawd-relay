import { AGENT_META } from "@clawd-relay/types";

interface HUDDevice {
  id: string;
  host: string;
  agentId: string;
  status: string;
  online: boolean;
}

interface Props {
  devices: HUDDevice[];
  onSelect: (deviceId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  working: "text-green-500",
  thinking: "text-amber-500 pulse-thinking",
  idle: "text-zinc-600",
  error: "text-red-500 pulse-error",
};

export function SessionHUD({ devices, onSelect }: Props) {
  if (devices.length === 0) return null;

  return (
    <div class="fixed bottom-0 left-0 right-0 md:left-auto md:right-0 md:top-12 md:bottom-auto bg-[#0c0c0c]/95 border-t md:border-t-0 md:border-l border-zinc-800 md:w-[180px] overflow-x-auto">
      <div class="flex md:flex-col gap-0 p-1 md:p-2">
        {devices.map((d) => {
          const icon = AGENT_META[d.agentId]?.icon ?? "?";
          const color = d.online ? (STATUS_COLORS[d.status] ?? "text-zinc-600") : "text-zinc-700";

          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              class={`flex items-center gap-1.5 px-2 py-1 text-mono-xs ${color} hover:text-zinc-300 transition-colors whitespace-nowrap shrink-0 text-left`}
            >
              <span>{icon}</span>
              <span class="hidden md:inline truncate">{d.host}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
