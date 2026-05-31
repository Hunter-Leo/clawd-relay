import type { DeviceState } from "../state/store";
import { DeviceGroup } from "./DeviceGroup";

interface Props {
  devices: Map<string, DeviceState>;
}

export function Dashboard({ devices }: Props) {
  if (devices.size === 0) return null;

  return (
    <div class="space-y-1">
      {Array.from(devices.values()).map((d) => (
        <DeviceGroup key={d.info.id} device={d} />
      ))}
    </div>
  );
}
