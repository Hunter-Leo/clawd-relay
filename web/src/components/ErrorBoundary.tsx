import { Component } from "preact";
import type { ComponentChildren } from "preact";

interface Props {
  children: ComponentChildren;
  fallback?: ComponentChildren;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div class="flex items-center justify-center p-8">
          <div class="text-center space-y-2">
            <p class="text-sm text-red-400">Component render error</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              class="text-xs text-zinc-500 hover:text-zinc-300 underline"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
