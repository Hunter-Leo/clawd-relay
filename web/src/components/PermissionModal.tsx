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
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
      <div class="w-full max-w-[560px] bg-[#0c0c0c] border border-zinc-800">
        {/* Title line */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div class="flex items-center gap-3">
            <span class="text-amber-500 text-mono-sm">&#9654;</span>
            <h2 class="text-mono-base text-zinc-200 font-semibold">permission request</h2>
          </div>
          <span class="text-mono-xs text-zinc-600">from {request.device.host}</span>
        </div>

        {/* Prompt */}
        <div class="px-4 py-3 border-b border-zinc-800/50">
          <p class="text-mono-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{request.prompt}</p>
        </div>

        {/* Tool info */}
        <div class="px-4 py-3 space-y-2 border-b border-zinc-800/50">
          <div class="flex items-center gap-3">
            <span class="text-mono-xs text-zinc-600 uppercase tracking-wider">tool</span>
            <span class="text-mono-sm text-amber-400">{request.toolName}</span>
          </div>
          {request.toolInput && Object.keys(request.toolInput).length > 0 && (
            <div>
              <span class="text-mono-xs text-zinc-600 uppercase tracking-wider block mb-1">input</span>
              <pre class="text-mono-xs text-zinc-500 bg-black/60 px-3 py-2 border border-zinc-800 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(request.toolInput, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div class="flex items-center justify-end gap-1 px-4 py-3">
          <button onClick={() => onDeny(request.permissionId)} class="text-mono-sm text-zinc-600 hover:text-zinc-400 px-3 py-1.5 transition-colors">
            [deny]
          </button>
          {stackCount <= 1 && (
            <button onClick={() => onAlwaysAllow(request.permissionId)} class="text-mono-sm text-zinc-600 hover:text-amber-500 px-3 py-1.5 transition-colors">
              [always allow]
            </button>
          )}
          <button onClick={() => onAllow(request.permissionId)} class="text-mono-sm text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-1.5 transition-colors">
            [allow]
          </button>
        </div>

        {stackCount > 1 && (
          <div class="px-4 pb-3">
            <span class="text-mono-xs text-zinc-600">+{stackCount - 1} pending</span>
          </div>
        )}
      </div>
    </div>
  );
}
