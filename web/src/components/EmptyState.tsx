import { useI18n } from "../i18n/index";

interface Props {
  onConnect: (token: string) => void;
}

export function EmptyState({ onConnect }: Props) {
  const { t } = useI18n();

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).querySelector("input");
    if (input?.value.trim()) {
      onConnect(input.value.trim());
    }
  };

  return (
    <div class="flex items-center justify-center min-h-[60dvh] px-4">
      <div class="text-center max-w-md space-y-6">
        <div class="text-4xl">🔗</div>
        <h1 class="text-xl font-semibold text-zinc-100">{t("empty.no_token.title")}</h1>
        <p class="text-sm text-zinc-400 leading-relaxed">{t("empty.no_token.desc")}</p>
        <form onSubmit={handleSubmit} class="flex gap-2">
          <input
            type="text"
            placeholder="your_token_here"
            class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-colors"
          >
            {t("empty.no_token.connect")}
          </button>
        </form>
      </div>
    </div>
  );
}
