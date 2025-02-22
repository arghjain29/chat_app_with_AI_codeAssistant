/* eslint-disable no-unused-vars */
import { useState, useEffect, useContext, createRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../context/userContext.jsx";
import {
  intializeSocket,
  recieveMessage,
  sendMessage,
} from "../config/socket.js";
import axios from "../config/axios.js";

const Project = () => {
  const location = useLocation();
  const { user } = useContext(UserContext);
  const projectId = location.state.id;
  const messageBox = createRef();

  const [leftPanel, setLeftPanel] = useState(false); // Side panel state
  const [addUserModal, setAddUserModal] = useState(false); // Add user modal state
  const [selectedUserId, setSelectedUserId] = useState([]); // Selected user state in add modal
  const [fetchedUser, setFetchedUser] = useState([]); // Fetched user state
  const [projectCollabs, setProjectCollabs] = useState([]); // Project collaborators state
  const [thisProject, setThisProject] = useState({}); // Project state
  const [message, setMessage] = useState(""); // sending Message state

  const closeModal = () => {
    setAddUserModal(false);
    setSelectedUserId([]);
  };

  // final Submit button
  const handleAddCollaborator = async () => {
    try {
      const res = await axios.put("/api/projects/add-user", {
        users: selectedUserId,
        projectId: location.state.project._id,
      });

      console.log(res.data.message);
      closeModal();
    } catch (error) {
      console.log(error);
    }
  };

  // Handle user selection with array
  const handleSelection = (userId) => () => {
    setSelectedUserId((prevSelectedUserId) => {
      if (prevSelectedUserId.includes(userId)) {
        return prevSelectedUserId.filter((id) => id !== userId);
      } else {
        return [...prevSelectedUserId, userId];
      }
    });
  };

  // Fetch all users through API
  const fetchAllUsers = async () => {
    try {
      const res = await axios.get("/api/users/all");
      setFetchedUser(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchProjectDetails = async () => {
    try {
      const res = await axios.get(`/api/projects/get-project/${projectId}`);
      setThisProject(res.data);
      setProjectCollabs(res.data.users);
    } catch (error) {
      console.log(error);
    }
  };

  const sendMessageHandler = () => {
    if (message === "") return;
    sendMessage("project-message", { message, sender: user.username });
    appendOutgoingMessage(message);
    setMessage("");
  };

  useEffect(() => {
    intializeSocket(projectId);
    fetchProjectDetails();
    fetchAllUsers();

    recieveMessage("project-message", (data) => {
      console.log(data);
      appendIcomingMessage(data);
    });
  }, []);

  const appendIcomingMessage = (message) => {
    const messageBox = document.querySelector(".message-box");
    const Message = document.createElement("div");
    Message.className =
      "incoming message flex flex-col p-2 bg-slate-50 max-w-56 rounded-lg mb-2 m-2";
    Message.innerHTML = `
    <small class="text-end bg-slate-800 text-sm rounded-md w-fit px-2 text-white opacity-65 mb-2">
      ${message.sender}
    </small>
    <p class="text-left">
      ${message.message}
    </p>
    `;
    messageBox.appendChild(Message);
    scrollToBottom();
  };

  const appendOutgoingMessage = (message) => {
    const messageBox = document.querySelector(".message-box");
    const Message = document.createElement("div");
    Message.className =
      "outgoing ml-auto message flex flex-col p-2  bg-slate-500 text-white max-w-56 min-w-20 rounded-lg mb-2 m-2";
    Message.innerHTML = `
    <small class="opacity-85 bg-slate-800 text-sm rounded-md w-fit px-2 text-white mb-2">
      Me
    </small>
    <p class="text-end">
      ${message}
    </p>
    `;
    messageBox.appendChild(Message);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    messageBox.current.scrollTop = messageBox.current.scrollHeight;
  }

  return (
    <main className="h-screen w-screen flex">
      {/* Left section  */}
      <section className="left relative flex flex-col h-screen min-w-96 bg-slate-100 border-r border-slate-200">
        {/* Heading  */}
        <header className="flex select-none justify-between items-center p-2 px-4 w-full bg-white border-b absolute border-slate-200 z-10 top-0">
          <button
            onClick={() => {
              setAddUserModal(true);
            }}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 hover:scale-105 transition duration-300 ease-in-out"
          >
            <i className="ri-add-fill"></i>
            <span className="font-semibold">Add collaborator</span>
          </button>
          <button
            onClick={() => {
              setLeftPanel(true);
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:scale-105 rounded-md transition duration-300 ease-in-out"
          >
            <i className="ri-group-fill"></i>
          </button>
        </header>

        {/* Conversation Area  */}
        <div className="conversation-area py-14 flex-grow flex flex-col h-full bg-slate-300 relative">
          {/* Message content would go here */}
          <div
            ref={messageBox}
            className="message-box flex flex-grow flex-col overflow-y-auto scroll-smooth max-h-full "
          ></div>
          {/* Input container */}
          <div className="input-container p-2 border-t absolute bottom-0 w-full z-10 bg-slate-200 border-slate-200">
            <div className="inputField w-full flex gap-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
              <input
                className="flex-grow p-2 px-4 border-none outline-none text-sm"
                type="text"
                placeholder="Enter message here"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button
                className="px-4 text-slate-600 hover:text-slate-900"
                onClick={sendMessageHandler}
              >
                <i className="ri-send-plane-fill"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Side pannel Modal  */}
        <div
          className={`sidepanel min-w-96 flex flex-col gap-2 h-screen bg-slate-300 absolute top-0  transition-all duration-300 ease-in-out ${
            leftPanel ? "left-0" : "left-[-100%]"
          }`}
        >
          <header className="flex justify-between items-center p-2 px-3 bg-slate-100">
            <h1 className="text-lg font-medium">Project Collaborators</h1>
            <button
              className="p-2 hover:scale-110 transition duration-300 ease-in-out"
              onClick={() => {
                setLeftPanel(false);
              }}
            >
              <i className="ri-close-fill text-lg"></i>
            </button>
          </header>

          <div className="users flex flex-col gap-2 ">
            {projectCollabs.map((Tuser, index) => (
              <div
                key={index}
                className="user flex gap-2 cursor-pointer hover:bg-slate-400 transition-all ease-in-out bg-slate-200 items-center p-2 px-3 m-2 rounded-md"
              >
                <div className="aspect-square rounded-full bg-slate-600 flex items-center justify-center w-fit h-fit p-5">
                  <i className="ri-user-fill absolute text-white"></i>
                </div>
                <h1 className="font-semibold">
                  {Tuser.username}{" "}
                  {user ? (Tuser._id == user._id ? "(Me)" : "") : ""}
                </h1>
              </div>
            ))}
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
                className="mt-4 min-w-52 bg-slate-500 text-white p-2 rounded-md hover:bg-slate-600 transition duration-300 font-semibold"
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
