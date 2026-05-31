import { useI18n } from "../i18n/index";

interface Props {
  onConnect: (token: string) => void;
}

export function EmptyState({ onConnect }: Props) {
  const { t } = useI18n();

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).querySelector("input");
    const raw = input?.value.trim();
    if (!raw) return;
    for (const t of raw.split(/[\s,]+/)) {
      const token = t.trim();
      if (token) onConnect(token);
    }
  };

  return (
    <div class="flex items-center justify-center min-h-[60dvh]">
      <div class="text-center max-w-md space-y-5">
        <div class="text-mono-sm text-zinc-600">~ $ clawd relay</div>
        <h1 class="text-mono-lg text-zinc-200 font-semibold">{t("empty.no_token.title")}</h1>
        <p class="text-mono-sm text-zinc-600">{t("empty.no_token.desc")}</p>
        <form onSubmit={handleSubmit} class="flex gap-2">
          <input
            type="text"
            placeholder="$ connect token"
            class="flex-1 bg-transparent border border-zinc-800 px-3 py-2 text-mono-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-amber-500/50"
          />
          <button
            type="submit"
            class="px-4 py-2 text-mono-sm text-amber-500 border border-zinc-800 hover:bg-amber-500/10 transition-colors"
          >
            connect
          </button>
        </form>
      </div>
    </div>
  );
}
