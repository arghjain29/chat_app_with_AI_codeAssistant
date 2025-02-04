import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from '../config/axios.js';
import { UserContext } from '../context/user.context.jsx';

const Login = () => {

  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);


  const [loginDetails, setLoginDetails] = useState({
    email: '',
    password: ''
  });

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!loginDetails.email || !loginDetails.password) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await axios.post('/api/users/login', loginDetails);
      // console.log(response);
      localStorage.setItem('token', JSON.stringify(response.data.token));
      setUser(response.data.user);
      navigate('/');
    } catch (error) {
      console.error(error.response);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Login
        </h2>
        <form onSubmit={submitHandler}>
          <div className="mb-4">
            <label className="block text-gray-400 mb-2" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              onChange={(e) => setLoginDetails({...loginDetails, email: e.target.value})}
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
              onChange={(e) => setLoginDetails({...loginDetails, password: e.target.value})}
              className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full p-3 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition duration-300"
          >
            Login
          </button>
          <div className="text-center mt-4">
            <p className="text-gray-400">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="text-blue-500 hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
