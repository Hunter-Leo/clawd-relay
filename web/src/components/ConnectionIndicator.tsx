interface Props {
  status: "connected" | "connecting" | "disconnected";
}

const STATUS: Record<string, { text: string; color: string; pulse: string }> = {
  connected:    { text: "connected",   color: "text-green-500",  pulse: "" },
  connecting:   { text: "connecting",  color: "text-amber-500",  pulse: "pulse-thinking" },
  disconnected: { text: "disconnected",color: "text-red-500",    pulse: "" },
};

export function ConnectionIndicator({ status }: Props) {
  const s = STATUS[status];
  return (
    <span class={`text-mono-xs ${s.color} ${s.pulse}`}>
      [{s.text}]
    </span>
  );
}
