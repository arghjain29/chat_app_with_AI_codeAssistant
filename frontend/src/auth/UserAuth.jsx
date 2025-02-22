// import { useContext, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { UserContext } from "../context/userContext";
// import PropTypes from "prop-types";

// const UserAuth = ({ children }) => {
//   const { user } = useContext(UserContext);
//   const navigate = useNavigate();
//   const token = localStorage.getItem("token");

//   useEffect(() => {
//     if (!token) {
//       navigate("/login");
//     }
//   }, [navigate, token]);

//   if (user) {
//     return <>{children}</>;
//   }

//   return null; // Render nothing while redirecting
// };

// UserAuth.propTypes = {
//   children: PropTypes.node.isRequired,
// };

// export default UserAuth;

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
        setLoading(false);
      } catch (error) {
        console.error(error);
        navigate("/login");
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
    return <div>Loading...</div>; // Show a loading indicator while fetching user details
  }

  if (user) {
    return <>{children}</>;
  }

  return null; // Render nothing while redirecting
};

UserAuth.propTypes = {
  children: PropTypes.node.isRequired,
};

export default UserAuth;