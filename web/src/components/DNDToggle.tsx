interface Props {
  dnd: boolean;
  onToggle: (dnd: boolean) => void;
}

export function DNDToggle({ dnd, onToggle }: Props) {
  return (
    <button
      onClick={() => onToggle(!dnd)}
      class={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
        dnd ? "bg-indigo-500" : "bg-zinc-700"
      }`}
      aria-label={dnd ? "Disable DND" : "Enable DND"}
      title={dnd ? "Do Not Disturb (on)" : "Do Not Disturb (off)"}
    >
      <span
        class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
          dnd ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
