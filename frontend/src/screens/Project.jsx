import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axios from '../config/axios.js';

const Project = () => {
  const location = useLocation();

  useEffect(() => {
    fetchAllUsers();
  }, []);


  console.log(location.state);
  const [leftPanel, setLeftPanel] = useState(false); // Side panel state
  const [addUserModal, setAddUserModal] = useState(false); // Add user modal state
  const [selectedUserId, setSelectedUserId] = useState([]); // Selected user state
  const [fetchedUser, setFetchedUser] = useState([]); // Fetched user state

  const closeModal = () => {
    setAddUserModal(false);
    setSelectedUserId([]);
  };

  const handleAddCollaborator = () => {
    console.log(selectedUserId);
    closeModal();
  };

  const handleSelection = (userId) => () => {
    setSelectedUserId((prevSelectedUserId) => {
      if (prevSelectedUserId.includes(userId)) {
        return prevSelectedUserId.filter((id) => id !== userId);
      } else {
        return [...prevSelectedUserId, userId];
      }
    });
  };


  const fetchAllUsers = async () => {
    try {
      const res = await axios.get("/api/users/all");
      setFetchedUser(res.data);
    } catch (error) {
      console.log(error);
    }
  };


  return (
    <main className="h-screen w-screen flex">
      {/* Left section  */}
      <section className="left relative flex flex-col h-screen min-w-96 bg-slate-100 border-r border-slate-200">
        {/* Heading  */}
        <header className="flex select-none justify-between items-center p-2 px-4 w-full bg-white border-b border-slate-200">
          <button
            onClick={() => {
              setAddUserModal(true);
            }}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <i className="ri-add-fill"></i>
            <span className="font-semibold">Add collaborator</span>
          </button>
          <button
            onClick={() => {
              setLeftPanel(true);
              console.log(leftPanel);
            }}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-md transition duration-300 ease-in-out"
          >
            <i className="ri-group-fill"></i>
          </button>
        </header>

        {/* Conversation Area  */}
        <div className="conversation-area flex-grow flex flex-col bg-slate-300">
          {/* Message content would go here */}
          <div className="message-box flex-grow flex-col">
            {/* Incoming message Box  */}
            <div className="incoming message flex flex-col p-2 bg-slate-50 max-w-56 rounded-lg mb-3 m-2">
              <small className="text-end bg-slate-800 text-sm rounded-md w-fit px-2 text-white opacity-65 mb-2">
                Username
              </small>
              <p className="text-left">
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
              </p>
            </div>

            {/* Outgoing message Box  */}
            <div className="outgoing ml-auto message flex flex-col p-2 bg-slate-50 max-w-56 rounded-lg mb-3 m-2">
              <small className="opacity-65 bg-slate-800 text-sm rounded-md w-fit px-2 text-white mb-2">
                Username
              </small>
              <p className="text-end">
                Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                Fugiat, eum?
              </p>
            </div>
          </div>
          {/* Input container */}
          <div className="input-container p-4 border-t border-slate-200">
            <div className="inputField w-full flex gap-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
              <input
                className="flex-grow p-2 px-4 border-none outline-none text-sm"
                type="text"
                placeholder="Enter message here"
              />
              <button className="px-4 text-slate-600 hover:text-slate-900">
                <i className="ri-send-plane-fill"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Side pannel Modal  */}
        <div
          className={`sidepanel min-w-96 flex flex-col gap-2 h-screen bg-slate-300 absolute top-0  transition-all duration-300 ease-in-out ${
            leftPanel ? "left-0" : "left-[-100%]" }`}
        >
          <header className="flex justify-end p-2 px-3 bg-slate-100">
            <button
              className="p-2"
              onClick={() => {
                setLeftPanel(false);
              }}
            >
              <i className="ri-close-fill text-lg"></i>
            </button>
          </header>

          <div className="users flex flex-col gap-2 ">
            <div className="user flex gap-2 cursor-pointer hover:bg-slate-100 transition-all ease-in-out bg-slate-200 items-center p-2 px-3 m-2 rounded-md">
              <div className="aspect-square rounded-full bg-slate-100 flex items-center justify-center w-fit h-fit p-5">
                <i className="ri-user-fill absolute"></i>
              </div>
              <h1 className="font-semibold">Username</h1>
            </div>
          </div>
        </div>
      </section>

      {/* Right Section  */}
      <section className="right flex-grow bg-slate-200">
        {/* Main content area */}
      </section>

      {addUserModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
          onClick={closeModal}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Select User</h2>
              <button onClick={closeModal}>
                <i className="ri-close-line text-2xl"></i>
              </button>
            </header>
            <div className="users flex flex-col max-h-96 overflow-auto">
              {fetchedUser.map((user) => (
                <div
                  key={user._id}
                  onClick={handleSelection(user._id)}
                  className={`user flex gap-2 cursor-pointer hover:bg-slate-400 transition-all ease-in-out  items-center p-2 px-3 m-2 rounded-md ${
                    selectedUserId.includes(user._id)
                      ? "bg-slate-400"
                      : "bg-slate-200"
                  }`}
                >
                  <div className="aspect-square rounded-full bg-slate-600 flex items-center relative justify-center w-fit h-fit p-5">
                    <i className="ri-user-fill absolute text-white"></i>
                  </div>
                  <h1 className="font-semibold">{user.username}</h1>
                </div>
              ))}
            </div>
            <div className="btn flex justify-center">
              <button
                onClick={handleAddCollaborator}
                className="mt-4 min-w-52 bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition duration-300"
              >
                Add Collaborators
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Project;
