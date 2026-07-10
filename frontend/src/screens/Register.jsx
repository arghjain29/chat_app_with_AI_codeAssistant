import { Link, useNavigate } from "react-router-dom";
import { useState, useContext } from "react";
import axios from "../config/axios.js";
import { UserContext } from '../context/userContext.jsx';


const Register = () => {
  const navigate = useNavigate();
    const { setUser } = useContext(UserContext);

  const [registerDetails, setRegisterDetails] = useState({
    username: "",
    email: "",
    password: "",
    cpassword: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const newErrors = {};
    if (!registerDetails.username) newErrors.username = "Username is required";
    else if (registerDetails.username.length < 3) newErrors.username = "Username must be at least 3 characters";
    if (!registerDetails.email) newErrors.email = "Email is required";
    if (!registerDetails.password) newErrors.password = "Password is required";
    else if (registerDetails.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (registerDetails.password !== registerDetails.cpassword) newErrors.cpassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validate()) return;

    setLoading(true);
    try {
      const response = await axios.post("/api/users/register", registerDetails);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      navigate("/");
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || "Registration failed";
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Register a new account
        </h2>
        {serverError && (
          <div className="mb-4 p-3 rounded bg-red-500/20 border border-red-500 text-red-400 text-sm">
            {serverError}
          </div>
        )}
        <form onSubmit={submitHandler}>
          <div className="mb-4">
            <label className="block text-gray-400 mb-2" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              minLength={6}
              onChange={(e) =>
                setRegisterDetails({
                  ...registerDetails,
                  email: e.target.value,
                })
              }
              className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
              required
            />
            {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-gray-400 mb-2" htmlFor="username">
              User Name
            </label>
            <input
              type="text"
              id="username"
              minLength={3}
              onChange={(e) =>
                setRegisterDetails({
                  ...registerDetails,
                  username: e.target.value,
                })
              }
              className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Choose a username"
              required
            />
            {errors.username && <p className="text-red-400 text-sm mt-1">{errors.username}</p>}
          </div>
          <div className="mb-6">
            <label className="block text-gray-400 mb-2" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              onChange={(e) =>
                setRegisterDetails({
                  ...registerDetails,
                  password: e.target.value,
                })
              }
              className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
              autoComplete="off"
            />
            {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
          </div>
          <div className="mb-6">
            <label className="block text-gray-400 mb-2" htmlFor="cpassword">
              Confirm Password
            </label>
            <input
              type="password"
              id="cpassword"
              onChange={(e) =>
                setRegisterDetails({
                  ...registerDetails,
                  cpassword: e.target.value,
                })
              }
              className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Re-Enter your password"
              required
              autoComplete="off"
            />
            {errors.cpassword && <p className="text-red-400 text-sm mt-1">{errors.cpassword}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Registering..." : "Register"}
          </button>
          <div className="text-center mt-4">
            <p className="text-gray-400">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-500 hover:underline">
                Login
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
