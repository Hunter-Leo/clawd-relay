import { useI18n } from "../i18n/index";

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
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-12 md:pt-24 bg-black/70 backdrop-blur-sm animate-slide-up" onClick={onClose}>
      <div
        class="bg-zinc-900/95 border border-zinc-800/60 rounded-2xl w-[90vw] md:w-[400px] max-h-[80dvh] overflow-y-auto shadow-2xl animate-permission-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <h2 class="text-sm font-semibold text-zinc-100">{t("settings.title")}</h2>
          <button onClick={onClose} class="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all duration-150 text-lg leading-none">&times;</button>
        </div>

        <div class="p-5 space-y-6">
          {/* Display */}
          <section class="space-y-3">
            <h3 class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{t("settings.display")}</h3>
            <div class="flex items-center justify-between py-1.5 hover:bg-zinc-800/30 px-2 -mx-2 rounded-lg transition-colors">
              <span class="text-sm text-zinc-300">{t("settings.theme")}</span>
              <select
                value={theme}
                onChange={(e) => onThemeChange((e.target as HTMLSelectElement).value as any)}
                class="text-sm bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/60 transition-colors"
              >
                <option value="dark">{t("settings.theme.dark")}</option>
                <option value="light">{t("settings.theme.light")}</option>
                <option value="system">{t("settings.theme.system")}</option>
              </select>
            </div>
            <div class="flex items-center justify-between py-1.5 hover:bg-zinc-800/30 px-2 -mx-2 rounded-lg transition-colors">
              <span class="text-sm text-zinc-300">{t("settings.language")}</span>
              <select
                value={locale}
                onChange={(e) => onLocaleChange((e.target as HTMLSelectElement).value as "zh-CN" | "en")}
                class="text-sm bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/60 transition-colors"
              >
                <option value="en">English</option>
                <option value="zh-CN">中文</option>
              </select>
            </div>
          </section>

          {/* Notifications */}
          <section class="space-y-3">
            <h3 class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{t("settings.notifications")}</h3>
            <label class="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-zinc-800/30 transition-colors cursor-pointer">
              <span class="text-sm text-zinc-300">{t("settings.dnd")}</span>
              <input type="checkbox" checked={dnd} onChange={(e) => onDndChange((e.target as HTMLInputElement).checked)} class="toggle toggle-sm" />
            </label>
            <label class="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-zinc-800/30 transition-colors cursor-pointer">
              <span class="text-sm text-zinc-300">{t("settings.sound")}</span>
              <input type="checkbox" checked={sound} onChange={(e) => onSoundChange((e.target as HTMLInputElement).checked)} class="toggle toggle-sm" />
            </label>
            {sound && (
              <div class="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg transition-colors">
                <span class="text-sm text-zinc-300">{t("settings.sound_volume")}</span>
                <input
                  type="range"
                  min="0" max="1" step="0.1"
                  value={volume}
                  onInput={(e) => onVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
                  class="range range-xs w-28"
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
