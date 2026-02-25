import { Component } from 'react'

/**
 * ErrorBoundary : intercepte les erreurs React et affiche un message de debug
 * au lieu d'une page blanche. Utile pour identifier la source des plantages.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, errorInfo: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
            <h1 className="text-xl font-bold text-red-600 mb-4">
              Une erreur s&apos;est produite
            </h1>
            <p className="text-gray-700 mb-4 font-mono text-sm break-all">
              {this.state.error?.message || String(this.state.error)}
            </p>
            {this.state.errorInfo?.componentStack && (
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-48 text-gray-600">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Recharger la page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
