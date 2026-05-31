import { useI18n } from "../i18n/index";
import type { DeviceState } from "../state/store";
import { DeviceGroup } from "./DeviceGroup";

interface Props {
  devices: Map<string, DeviceState>;
}

export function Dashboard({ devices }: Props) {
  const { t } = useI18n();
  const onlineCount = Array.from(devices.values()).filter((d) => d.online).length;

  if (devices.size === 0) {
    return null;
  }

  return (
    <div class="space-y-5 animate-slide-up">
      <div class="flex items-center justify-between">
        <h2 class="text-xs text-zinc-500 font-medium uppercase tracking-wider">
          {t("device.online_devices")} &middot; {onlineCount}/{devices.size}
        </h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {Array.from(devices.values()).map((device) => (
          <DeviceGroup key={device.info.id} device={device} />
        ))}
      </div>
    </div>
  );
}
