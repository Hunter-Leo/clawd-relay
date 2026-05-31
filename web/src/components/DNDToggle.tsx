interface Props {
  dnd: boolean;
  onToggle: (dnd: boolean) => void;
}

export function DNDToggle({ dnd, onToggle }: Props) {
  return (
    <button
      onClick={() => onToggle(!dnd)}
      class={`text-mono-xs px-2 py-1 transition-colors ${
        dnd
          ? "text-amber-500 bg-amber-500/10"
          : "text-zinc-600 hover:text-zinc-400"
      }`}
      aria-label={dnd ? "Disable DND" : "Enable DND"}
    >
      [{dnd ? "dnd" : "bell"}]
    </button>
  );
}
