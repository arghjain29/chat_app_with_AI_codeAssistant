import { Link } from "react-router-dom";

const NotFound = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="text-center">
                <h1 className="text-7xl font-bold text-white mb-4">404</h1>
                <p className="text-gray-400 text-xl mb-8">Page not found</p>
                <Link
                    to="/"
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                >
                    Go Home
                </Link>
            </div>
        </div>
    );
};

export default NotFound;
