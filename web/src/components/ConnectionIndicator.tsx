import { useI18n } from "../i18n/index";
import type { ConnectionStatus } from "../state/store";

interface Props {
  status: ConnectionStatus;
}

const COLORS: Record<ConnectionStatus, string> = {
  connected: "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]",
  connecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-red-500",
};

export function ConnectionIndicator({ status }: Props) {
  const { t } = useI18n();
  const label = t(`connection.${status}`);

  return (
    <div class="flex items-center gap-2">
      <span class={`w-2 h-2 rounded-full ${COLORS[status]}`} />
      <span class="text-xs text-zinc-400 hidden sm:inline" title={label}>
        {label}
      </span>
    </div>
  );
}
