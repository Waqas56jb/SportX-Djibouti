import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/common/States';

/** Catches render errors per route so one broken screen never blanks the whole admin. */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for future error reporting (e.g. Sentry). Never shown to the user.
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  render() {
    if (this.state.failed)
      return (
        <div className="panel">
          <ErrorState description="This page failed to load. Try again, or return to the dashboard." onRetry={() => this.setState({ failed: false })} />
        </div>
      );
    return this.props.children;
  }
}
