import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/userContext";
import PropTypes from "prop-types";
import axios from "../config/axios.js";

const UserAuth = ({ children }) => {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get("/api/users/profile");
        setUser(response.data);
      } catch (error) {
        console.error("[UserAuth] Session expired or invalid");
        localStorage.removeItem("token");
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    if (!token) {
      navigate("/login");
    } else if (!user) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [navigate, token, user, setUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return null;
};

UserAuth.propTypes = {
  children: PropTypes.node.isRequired,
};

export default UserAuth;
