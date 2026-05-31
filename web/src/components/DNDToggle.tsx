import { useI18n } from "../i18n/index";

interface Props {
  dnd: boolean;
  onToggle: (dnd: boolean) => void;
}

export function DNDToggle({ dnd, onToggle }: Props) {
  const { t } = useI18n();

  return (
    <button
      onClick={() => onToggle(!dnd)}
      class={`relative w-9 h-5 rounded-full transition-all duration-200 ${
        dnd ? "bg-indigo-500/80 shadow-[0_0_6px_rgba(99,102,241,0.3)]" : "bg-zinc-700"
      }`}
      aria-label={dnd ? "Disable DND" : "Enable DND"}
      title={dnd ? t("dnd.enabled") : t("dnd.disabled")}
    >
      <span
        class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
          dnd ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
