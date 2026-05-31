import type { PermissionRequestMsg } from "@clawd-relay/types";
import { useI18n } from "../i18n/index";

interface Props {
  request: PermissionRequestMsg;
  onAllow: (permissionId: string) => void;
  onDeny: (permissionId: string) => void;
  onAlwaysAllow: (permissionId: string) => void;
  stackCount: number;
}

export function PermissionModal({ request, onAllow, onDeny, onAlwaysAllow, stackCount }: Props) {
  const { t } = useI18n();

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div class="bg-zinc-900/95 border border-zinc-700/60 rounded-2xl shadow-2xl max-w-[90vw] md:max-w-[560px] w-full max-h-[90dvh] overflow-y-auto animate-permission-enter">
        {/* Header */}
        <div class="flex items-center justify-between px-5 md:px-6 pt-4 md:pt-5 pb-3">
          <div class="flex items-center gap-2.5">
            <span class="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/10 text-yellow-400 text-sm">&#9888;</span>
            <h2 class="text-sm font-semibold text-zinc-100">{t("permission.title")}</h2>
          </div>
          <span class="text-[11px] text-zinc-500">{t("permission.from", { device: request.device.host })}</span>
        </div>

        {/* Prompt */}
        <div class="px-5 md:px-6 py-2">
          <div class="bg-zinc-950/60 rounded-xl px-4 py-3 border border-zinc-800/50">
            <p class="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{request.prompt}</p>
          </div>
        </div>

        {/* Tool info */}
        <div class="px-5 md:px-6 py-2 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{t("permission.modal.tool")}</span>
            <span class="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">{request.toolName}</span>
          </div>
          {request.toolInput && Object.keys(request.toolInput).length > 0 && (
            <div>
              <span class="text-[11px] text-zinc-500 font-medium uppercase tracking-wider block mb-1.5">{t("permission.modal.input")}</span>
              <pre class="text-xs text-zinc-400 font-mono bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/50 max-h-24 md:max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(request.toolInput, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-5 md:px-6 py-4 border-t border-zinc-800/50 mt-2">
          <button
            onClick={() => onDeny(request.permissionId)}
            class="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors rounded-xl hover:bg-zinc-800/60 active:scale-[0.98]"
          >
            {t("permission.deny")}
          </button>
          {stackCount <= 1 && (
            <button
              onClick={() => onAlwaysAllow(request.permissionId)}
              class="px-4 py-2 text-sm text-zinc-400 hover:text-indigo-400 transition-colors rounded-xl hover:bg-zinc-800/60 active:scale-[0.98]"
            >
              {t("permission.always_allow")}
            </button>
          )}
          <button
            onClick={() => onAllow(request.permissionId)}
            class="px-6 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 active:scale-95 transition-all rounded-xl shadow-lg shadow-indigo-500/20"
          >
            {t("permission.allow")}
          </button>
        </div>

        {/* Stack badge */}
        {stackCount > 1 && (
          <div class="px-5 md:px-6 pb-4">
            <span class="text-xs text-zinc-500 bg-zinc-800/60 px-2 py-1 rounded-full">{t("permission.stack_count", { n: stackCount - 1 })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
