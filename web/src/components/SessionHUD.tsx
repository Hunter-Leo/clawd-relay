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
  working: "bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.4)]",
  thinking: "bg-yellow-400 animate-breathe",
  idle: "bg-zinc-500",
  error: "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.4)]",
};

export function SessionHUD({ devices, onSelect }: Props) {
  if (devices.length === 0) return null;

  return (
    <div class="fixed bottom-0 left-0 right-0 md:right-5 md:left-auto md:bottom-5 md:w-auto md:rounded-xl border-t md:border border-zinc-800/50 overflow-x-auto"
         style={{ background: "rgba(9,9,11,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
      <div class="flex md:flex-col gap-0 md:gap-0.5 p-1.5 md:p-2 min-w-0">
        {devices.map((d) => {
          const agentIcon = AGENT_META[d.agentId]?.icon ?? "?";
          const dotColor = d.online ? (STATUS_COLORS[d.status] ?? "bg-zinc-500") : "bg-zinc-600";

          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-all duration-150 whitespace-nowrap flex-shrink-0"
              title={`${d.host} — ${d.status}`}
            >
              <span class={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
              <span class="flex-shrink-0 leading-none">{agentIcon}</span>
              <span class="hidden md:inline truncate max-w-[80px]">{d.host}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
