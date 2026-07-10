import { useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/userContext.jsx";
import { ToastContext } from "./ToastContext.jsx";
import axios from "../config/axios.js";

const Navbar = () => {
    const { user, setUser } = useContext(UserContext);
    const { toast } = useContext(ToastContext);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        try {
            await axios.post("/api/users/logout");
            localStorage.removeItem("token");
            setUser(null);
            toast.success("Logged out");
            navigate("/login");
        } catch (error) {
            localStorage.removeItem("token");
            setUser(null);
            navigate("/login");
        }
    };

    if (!user) return null;

    return (
        <nav className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2 font-bold text-lg text-slate-800">
                    <i className="ri-code-s-slash-line text-blue-500"></i>
                    CodeCollab
                </Link>
                {location.pathname !== "/" && (
                    <Link
                        to="/"
                        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <i className="ri-home-4-line mr-1"></i>Projects
                    </Link>
                )}
            </div>
            <div className="flex items-center gap-4">
                <Link
                    to="/profile"
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                        {user.username?.[0]?.toUpperCase()}
                    </div>
                    <span>{user.username}</span>
                </Link>
                <button
                    onClick={handleLogout}
                    className="text-sm text-slate-500 hover:text-red-500 transition-colors"
                >
                    <i className="ri-logout-box-r-line"></i>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
