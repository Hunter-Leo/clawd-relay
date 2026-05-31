import { useI18n } from "../i18n/index";
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

const HUD_ABBREV: Record<string, string> = {
  working: "hud.working",
  thinking: "hud.thinking",
  idle: "hud.idle",
  error: "hud.error",
};

const STATUS_COLORS: Record<string, string> = {
  working: "bg-green-500",
  thinking: "bg-yellow-500 animate-breathe",
  idle: "bg-zinc-500",
  error: "bg-red-500",
};

export function SessionHUD({ devices, onSelect }: Props) {
  const { t } = useI18n();

  if (devices.length === 0) return null;

  return (
    <div class="fixed bottom-0 left-0 right-0 md:right-5 md:left-auto md:bottom-5 md:w-auto bg-zinc-900/80 md:rounded-xl border-t md:border border-zinc-800/60 backdrop-blur-lg overflow-x-auto shadow-2xl">
      <div class="flex md:flex-col gap-0 md:gap-0.5 p-1.5 md:p-1.5 min-w-0">
        {devices.map((d) => {
          const agentIcon = AGENT_META[d.agentId]?.icon ?? "?";
          const abbrev = HUD_ABBREV[d.status] ?? "hud.offline";
          const dotColor = d.online ? (STATUS_COLORS[d.status] ?? "bg-zinc-500") : "bg-zinc-600";

          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition-all duration-150 whitespace-nowrap flex-shrink-0 active:scale-[0.97]"
              title={`${d.host} — ${d.status}`}
            >
              <span class={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-300 ${dotColor}`} />
              <span class="flex-shrink-0 leading-none">{agentIcon}</span>
              <span class="hidden md:inline truncate max-w-[80px]">{d.host}</span>
              <span class="text-zinc-600">{t(abbrev)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
