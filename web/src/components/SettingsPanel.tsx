import { useI18n } from "../i18n/index";
import type { Settings } from "../state/store";

interface Props {
  locale: string;
  theme: string;
  dnd: boolean;
  sound: boolean;
  volume: number;
  onLocaleChange: (locale: "zh-CN" | "en") => void;
  onThemeChange: (theme: "dark" | "light" | "system") => void;
  onDndChange: (dnd: boolean) => void;
  onSoundChange: (sound: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
}

export function SettingsPanel({
  locale, theme, dnd, sound, volume,
  onLocaleChange, onThemeChange, onDndChange, onSoundChange, onVolumeChange,
  onClose,
}: Props) {
  const { t } = useI18n();

  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/80" onClick={onClose}>
      <div
        class="bg-[#0c0c0c] border border-zinc-800 w-[90vw] md:w-[380px] max-h-[70dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 class="text-mono-base text-zinc-200 font-semibold">settings</h2>
          <button onClick={onClose} class="text-mono-sm text-zinc-600 hover:text-zinc-400">&times;</button>
        </div>

        <div class="p-4 space-y-5">
          {/* Display */}
          <section class="space-y-3">
            <h3 class="text-mono-xs text-zinc-600 uppercase tracking-wider">display</h3>
            <SettingRow label={t("settings.theme")}>
              <select value={theme} onChange={(e) => onThemeChange((e.target as HTMLSelectElement).value as any)}
                class="bg-transparent text-mono-sm text-zinc-400 border border-zinc-800 px-2 py-1 focus:outline-none focus:border-amber-500/50">
                <option value="dark">dark</option>
                <option value="light">light</option>
                <option value="system">system</option>
              </select>
            </SettingRow>
            <SettingRow label={t("settings.language")}>
              <select value={locale} onChange={(e) => onLocaleChange((e.target as HTMLSelectElement).value as any)}
                class="bg-transparent text-mono-sm text-zinc-400 border border-zinc-800 px-2 py-1 focus:outline-none focus:border-amber-500/50">
                <option value="en">en</option>
                <option value="zh-CN">zh-CN</option>
              </select>
            </SettingRow>
          </section>

          {/* Notifications */}
          <section class="space-y-3">
            <h3 class="text-mono-xs text-zinc-600 uppercase tracking-wider">notifications</h3>
            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-mono-sm text-zinc-400">{t("settings.dnd")}</span>
              <input type="checkbox" checked={dnd} onChange={(e) => onDndChange((e.target as HTMLInputElement).checked)}
                class="accent-amber-500" />
            </label>
            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-mono-sm text-zinc-400">{t("settings.sound")}</span>
              <input type="checkbox" checked={sound} onChange={(e) => onSoundChange((e.target as HTMLInputElement).checked)}
                class="accent-amber-500" />
            </label>
            {sound && (
              <div class="flex items-center justify-between">
                <span class="text-mono-sm text-zinc-400">volume</span>
                <input type="range" min="0" max="1" step="0.1" value={volume}
                  onInput={(e) => onVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
                  class="w-24 accent-amber-500" />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <div class="flex items-center justify-between">
      <span class="text-mono-sm text-zinc-400">{label}</span>
      {children}
    </div>
  );
}
