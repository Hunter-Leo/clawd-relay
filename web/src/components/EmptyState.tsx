import { useState } from "preact/hooks";
import { useI18n } from "../i18n/index";

interface Props {
  onConnect: (token: string) => void;
  onRelayUrlChange: (url: string) => void;
  serverUrl: string;
}

export function EmptyState({ onConnect, onRelayUrlChange, serverUrl }: Props) {
  const { t } = useI18n();
  const [tokens, setTokens] = useState<string[]>([""]);

  const handleAddToken = () => {
    setTokens([...tokens, ""]);
  };

  const handleTokenChange = (index: number, value: string) => {
    const next = [...tokens];
    next[index] = value;
    setTokens(next);
  };

  const handleConnect = () => {
    const valid = tokens.map((t) => t.trim()).filter(Boolean);
    if (valid.length === 0) return;
    onRelayUrlChange(serverUrl || window.location.origin);
    for (const token of valid) {
      onConnect(token);
    }
    setTokens([""]);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConnect();
    }
  };

  return (
    <div class="flex items-center justify-center min-h-[60dvh]">
      <div class="text-center max-w-md space-y-5 w-full">
        <div class="text-mono-sm text-zinc-600">~ $ clawd relay</div>
        <h1 class="text-mono-lg text-zinc-200 font-semibold">{t("empty.no_token.title")}</h1>
        <p class="text-mono-sm text-zinc-600">{t("empty.no_token.desc")}</p>

        <div class="space-y-3 text-left">
          <div>
            <label class="text-mono-xs text-zinc-600 block mb-1">Relay Server</label>
            <input
              type="text"
              value={serverUrl}
              onInput={(e) => onRelayUrlChange((e.target as HTMLInputElement).value)}
              placeholder="https://relay.example.com"
              class="w-full bg-transparent border border-zinc-800 px-3 py-2 text-mono-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label class="text-mono-xs text-zinc-600 block mb-1">Tokens</label>
            {tokens.map((token, i) => (
              <div class="flex gap-2 mb-2" key={i}>
                <input
                  type="text"
                  value={token}
                  onInput={(e) => handleTokenChange(i, (e.target as HTMLInputElement).value)}
                  onKeyDown={handleKeyDown}
                  placeholder="$ connect token"
                  class="flex-1 bg-transparent border border-zinc-800 px-3 py-2 text-mono-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-amber-500/50"
                />
                {i === tokens.length - 1 && (
                  <button
                    onClick={handleAddToken}
                    class="px-3 py-2 text-mono-sm text-zinc-500 border border-zinc-800 hover:text-amber-500 hover:border-amber-500/50 transition-colors"
                    title="Add another token"
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleConnect}
          class="px-4 py-2 text-mono-sm text-amber-500 border border-zinc-800 hover:bg-amber-500/10 transition-colors"
        >
          connect
        </button>
      </div>
    </div>
  );
}
