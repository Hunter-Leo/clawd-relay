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
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="bg-zinc-900 border border-zinc-700 rounded-xl max-w-[90vw] md:max-w-[560px] w-full max-h-[90dvh] overflow-y-auto animate-permission-enter">
        {/* Header */}
        <div class="flex items-center justify-between px-4 md:px-6 pt-4 md:pt-6 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-yellow-400 text-lg">&#9888;</span>
            <h2 class="text-sm font-semibold text-zinc-100">{t("permission.title")}</h2>
          </div>
          <span class="text-xs text-zinc-500">{t("permission.from", { device: request.device.host })}</span>
        </div>

        {/* Prompt */}
        <div class="px-4 md:px-6 py-2">
          <p class="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{request.prompt}</p>
        </div>

        {/* Tool info */}
        <div class="px-4 md:px-6 py-2 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-zinc-500">{t("permission.modal.tool")}:</span>
            <span class="text-xs font-mono text-indigo-400">{request.toolName}</span>
          </div>
          {request.toolInput && Object.keys(request.toolInput).length > 0 && (
            <div>
              <span class="text-xs text-zinc-500 block mb-1">{t("permission.modal.input")}:</span>
              <pre class="text-xs text-zinc-400 font-mono bg-zinc-950 rounded-lg p-3 max-h-24 md:max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(request.toolInput, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 md:px-6 py-4 border-t border-zinc-800">
          <button
            onClick={() => onDeny(request.permissionId)}
            class="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-800"
          >
            {t("permission.deny")}
          </button>
          {stackCount <= 1 && (
            <button
              onClick={() => onAlwaysAllow(request.permissionId)}
              class="px-4 py-2 text-sm text-zinc-400 hover:text-indigo-400 transition-colors rounded-lg hover:bg-zinc-800"
            >
              {t("permission.always_allow")}
            </button>
          )}
          <button
            onClick={() => onAllow(request.permissionId)}
            class="px-6 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 active:scale-[0.97] transition-all rounded-lg"
          >
            {t("permission.allow")}
          </button>
        </div>

        {/* Stack badge */}
        {stackCount > 1 && (
          <div class="px-4 md:px-6 pb-4">
            <span class="text-xs text-zinc-500">{t("permission.stack_count", { n: stackCount - 1 })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
