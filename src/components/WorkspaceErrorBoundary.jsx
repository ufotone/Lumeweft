import { Component } from 'react'

class WorkspaceErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || String(error || '') }
  }

  componentDidCatch(error, info) {
    console.error('Workspace crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-sf-dark-950 px-6">
          <div className="max-w-md rounded-2xl border border-red-500/25 bg-sf-dark-900 px-6 py-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="text-sm font-semibold text-red-200">Workspace failed to load</div>
            <p className="mt-2 text-sm text-sf-text-muted">
              {typeof this.props.onRetry === 'function'
                ? 'This tab hit a runtime error, but the rest of the app is still safe. Reload the workspace to retry.'
                : 'This tab hit a runtime error, but the rest of the app is still safe.'}
            </p>
            {this.state.errorMessage && (
              <div className="mt-3 break-words rounded-lg border border-red-500/20 bg-sf-dark-950/70 px-3 py-2 text-left font-mono text-[11px] text-red-100/80">
                {this.state.errorMessage}
              </div>
            )}
            {typeof this.props.onEscape === 'function' && (
              <button
                type="button"
                onClick={this.props.onEscape}
                className="mt-4 rounded-lg bg-sf-accent px-3 py-2 text-sm font-medium text-white hover:bg-sf-accent/90"
              >
                {this.props.escapeLabel || 'Back'}
              </button>
            )}
            {typeof this.props.onRetry === 'function' && (
              <button
                type="button"
                onClick={this.props.onRetry}
                className={`${typeof this.props.onEscape === 'function' ? 'ml-2' : ''} mt-4 rounded-lg border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-sm font-medium text-sf-text-primary hover:bg-sf-dark-700`}
              >
                {this.props.retryLabel || 'Reload workspace'}
              </button>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default WorkspaceErrorBoundary
