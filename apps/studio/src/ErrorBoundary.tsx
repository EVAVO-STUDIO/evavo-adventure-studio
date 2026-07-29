import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import "./failure.css";

export interface StudioErrorBoundaryProps {
  readonly children: ReactNode;
}

export interface StudioErrorBoundaryState {
  readonly error: Error | null;
}

export class StudioErrorBoundary extends Component<
  StudioErrorBoundaryProps,
  StudioErrorBoundaryState
> {
  state: StudioErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StudioErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Adventure Studio workspace failure", error, info);
  }

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="studio-failure" role="alert">
        <div className="studio-failure-card">
          <span className="studio-failure-mark">!</span>
          <span className="eyebrow">WORKSPACE RECOVERY</span>
          <h1>The scene editor stopped safely.</h1>
          <p>
            The document was not exported or overwritten. Reload the workspace,
            then reopen the last valid scene composition file.
          </p>
          <pre>{this.state.error.message}</pre>
          <button
            type="button"
            className="button primary-button"
            onClick={this.reload}
          >
            Reload workspace
          </button>
        </div>
      </main>
    );
  }
}
