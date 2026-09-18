import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/userContext.jsx";
import { ToastContext } from "../components/ToastContext.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import axios from "../config/axios.js";

const Profile = () => {
    const { user, setUser } = useContext(UserContext);
    const { toast } = useContext(ToastContext);
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        if (user) setUsername(user.username || "");
    }, [user]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!username || username.length < 3) {
            toast.error("Username must be at least 3 characters");
            return;
        }
        setLoading(true);
        try {
            const res = await axios.put("/api/users/update-profile", { username });
            setUser(res.data);
            toast.success("Profile updated");
        } catch (error) {
            const msg = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || "Update failed";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!currentPassword || !newPassword) {
            toast.error("All password fields are required");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("New password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmNewPassword) {
            toast.error("New passwords do not match");
            return;
        }
        setLoading(true);
        try {
            await axios.put("/api/users/change-password", { currentPassword, newPassword });
            toast.success("Password changed");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
        } catch (error) {
            const msg = error.response?.data?.message || "Password change failed";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            await axios.delete("/api/users/delete-account");
            localStorage.removeItem("token");
            setUser(null);
            toast.success("Account deleted");
            navigate("/login");
        } catch (error) {
            toast.error("Failed to delete account");
        }
        setShowDeleteModal(false);
    };

    const handleLogout = async () => {
        try {
            await axios.post("/api/users/logout");
        } catch {}
        localStorage.removeItem("token");
        setUser(null);
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-2xl mx-auto p-6">
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                            {user?.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{user?.username}</h1>
                            <p className="text-gray-400">{user?.email}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4">Update Username</h2>
                    <form onSubmit={handleUpdateProfile}>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-2">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                minLength={3}
                                maxLength={20}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </form>
                </div>

                <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4">Change Password</h2>
                    <form onSubmit={handleChangePassword}>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-2">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-2">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-2">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Changing..." : "Change Password"}
                        </button>
                    </form>
                </div>

                <div className="bg-gray-800 rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Danger Zone</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">Delete Account</p>
                            <p className="text-gray-400 text-sm">Permanently delete your account and all associated data</p>
                        </div>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                            Delete Account
                        </button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <button
                            onClick={handleLogout}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <i className="ri-logout-box-r-line mr-1"></i>Logout
                        </button>
                    </div>
                </div>

                <ConfirmModal
                    isOpen={showDeleteModal}
                    title="Delete Account"
                    message="This action cannot be undone. All your data will be permanently deleted."
                    onConfirm={handleDeleteAccount}
                    onCancel={() => setShowDeleteModal(false)}
                    confirmText="Delete"
                    confirmColor="bg-red-500 hover:bg-red-600"
                />
            </div>
        </div>
    );
};

export default Profile;
