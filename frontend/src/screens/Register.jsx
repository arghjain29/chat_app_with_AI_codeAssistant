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

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!registerDetails.username || !registerDetails.email || !registerDetails.password || !registerDetails.cpassword) {
      alert("Please fill in all fields");
      return;
    }

    if (registerDetails.password !== registerDetails.cpassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const response = await axios.post("/api/users/register", registerDetails);
      // console.log(response.data);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      navigate("/");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Register a new account
        </h2>
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
          </div>
          <div className="mb-4">
            <label className="block text-gray-400 mb-2" htmlFor="email">
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
              placeholder="Enter your email"
              required
            />
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
          </div>
          <div className="mb-6">
            <label className="block text-gray-400 mb-2" htmlFor="password">
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
          </div>
          <button
            type="submit"
            className="w-full p-3 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition duration-300"
          >
            Register
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
