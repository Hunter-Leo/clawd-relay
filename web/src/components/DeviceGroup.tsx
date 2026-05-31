import type { DeviceState } from "../state/store";
import { SessionCard } from "./SessionCard";
import { useI18n } from "../i18n/index";

interface Props {
  device: DeviceState;
}

export function DeviceGroup({ device }: Props) {
  const { t } = useI18n();
  const { info, sessions, online, lastSeen } = device;
  const count = sessions.length;
  const diff = Date.now() - lastSeen;
  const mins = Math.floor(diff / 60000);
  const timeLabel = mins < 1 ? t("device.just_now") : t("device.minutes_ago", { n: mins });

  return (
    <div id={`device-${info.id}`} class="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between px-3 md:px-4 py-3 border-b border-zinc-800">
        <div class="flex items-center gap-3 min-w-0">
          <span class={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-green-500" : "bg-zinc-600"}`} />
          <span class="text-sm font-medium text-zinc-100 truncate">{info.host}</span>
          <span class="text-xs text-zinc-500">{info.platform}</span>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <span class={`text-xs ${online ? "text-green-500" : "text-zinc-600"}`}>
            {online ? t("device.online") : t("device.offline")}
          </span>
          <span class="text-xs text-zinc-600" title={new Date(lastSeen).toISOString()}>
            {timeLabel}
          </span>
          {count > 0 && (
            <span class="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div class="divide-y divide-zinc-800/50">
          {sessions.map((s) => (
            <div key={s.id} class="px-3 md:px-4 py-2">
              <SessionCard device={info} session={s} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {sessions.length === 0 && (
        <div class="px-4 py-6 text-center text-xs text-zinc-600">
          No active sessions
        </div>
      )}
    </div>
  );
}
