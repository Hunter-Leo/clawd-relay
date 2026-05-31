import { useI18n } from "../i18n/index";

interface Props {
  status: "connected" | "connecting" | "disconnected";
}

const CONFIG: Record<string, { dot: string; dotSize: string }> = {
  connected: {
    dot: "bg-green-500",
    dotSize: "w-2 h-2",
  },
  connecting: {
    dot: "bg-yellow-500",
    dotSize: "w-2 h-2",
  },
  disconnected: {
    dot: "bg-red-500",
    dotSize: "w-2 h-2",
  },
};

const DOT_ANIMATION: Record<string, string> = {
  connected: "shadow-[0_0_6px_rgba(34,197,94,0.5)]",
  connecting: "animate-breathe shadow-[0_0_6px_rgba(234,179,8,0.4)]",
  disconnected: "",
};

export function ConnectionIndicator({ status }: Props) {
  const { t } = useI18n();
  const label = t(`connection.${status}`);
  const cfg = CONFIG[status];

  return (
    <div class="flex items-center gap-2" title={label}>
      <span class={`${cfg.dotSize} rounded-full ${cfg.dot} ${DOT_ANIMATION[status]} transition-all duration-300`} />
      <span class="text-xs text-zinc-400 hidden sm:inline">{label}</span>
    </div>
  );
}
