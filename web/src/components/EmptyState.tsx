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
    <div class="flex items-center justify-center min-h-[60dvh] px-4 animate-slide-up">
      <div class="text-center max-w-md space-y-6">
        <div class="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 text-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-400">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <h1 class="text-xl font-semibold text-zinc-100">{t("empty.no_token.title")}</h1>
        <p class="text-sm text-zinc-500 leading-relaxed">{t("empty.no_token.desc")}</p>
        <form onSubmit={handleSubmit} class="flex gap-2 max-w-sm mx-auto">
          <input
            type="text"
            placeholder="token1, token2, ..."
            class="flex-1 bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all duration-200"
          />
          <button
            type="submit"
            class="px-5 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 active:scale-95 rounded-xl transition-all duration-150 shadow-lg shadow-indigo-500/20"
          >
            {t("empty.no_token.connect")}
          </button>
        </form>
      </div>
    </div>
  );
}
