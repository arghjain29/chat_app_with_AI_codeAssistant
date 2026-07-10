import { Component } from "react";

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("[ErrorBoundary]", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-900">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md text-center">
                        <i className="ri-error-warning-line text-5xl text-red-400 mb-4"></i>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-gray-400 mb-6">
                            An unexpected error occurred. Please try again.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
