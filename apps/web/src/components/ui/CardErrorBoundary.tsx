'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback. Defaults to a quiet grey placeholder card. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Wrap any dashboard section with this boundary.
 * If one card crashes, the rest of the page keeps rendering.
 *
 * Usage:
 *   <CardErrorBoundary>
 *     <SomeCard />
 *   </CardErrorBoundary>
 */
export class CardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Only log in development — never expose in production
    if (process.env.NODE_ENV === 'development') {
      console.error('[CardErrorBoundary]', error.message, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="rounded-xl p-5 flex items-center justify-center min-h-[72px]"
          style={{
            backgroundColor: '#0F0F1A',
            border:           '1px solid #1A1A2E',
          }}
        >
          <p className="text-sm" style={{ color: '#4A4A6A' }}>
            Something went wrong here. Refresh to try again.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
