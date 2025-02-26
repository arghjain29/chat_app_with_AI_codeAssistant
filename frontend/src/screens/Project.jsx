import { useState, useEffect, useContext, useRef } from "react";
import { useLocation } from "react-router-dom";
import { UserContext } from "../context/userContext.jsx";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import Markdown from "markdown-to-jsx";
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
  const messageBox = useRef(null);

  const [leftPanel, setLeftPanel] = useState(false); // Side panel state
  const [addUserModal, setAddUserModal] = useState(false); // Add user modal state
  const [selectedUserId, setSelectedUserId] = useState([]); // Selected user state in add modal
  const [fetchedUser, setFetchedUser] = useState([]); // Fetched user state
  const [projectCollabs, setProjectCollabs] = useState([]); // Project collaborators state
  const [thisProject, setThisProject] = useState({}); // Project state
  const [message, setMessage] = useState(""); // sending Message state
  const [messages, setMessages] = useState([]); // Messages state
  const [selectedFile, setSelectedFile] = useState(""); // Selected file state
  const [fileTree, setFileTree] = useState(null); // File tree state

  const closeModal = () => {
    setAddUserModal(false);
    setSelectedUserId([]);
  };

  function getSyntaxHighlighterLanguage(filename) {
    const extensionMap = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      rb: "ruby",
      php: "php",
      swift: "swift",
      go: "go",
      kt: "kotlin",
      rs: "rust",
      sh: "bash",
      html: "xml", // Syntax highlighter uses 'xml' for HTML
      css: "css",
      scss: "scss",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      md: "markdown",
      sql: "sql",
      lua: "lua",
      r: "r",
      dart: "dart",
      txt: "text",
    };

    const ext = filename.split(".").pop().toLowerCase();
    return extensionMap[ext] || "text"; // Default to 'text' if unknown
  }

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

  function WriteAimessage(msg) {
    const messageText = JSON.parse(msg.message);
    return (
      <div className="overflow-auto bg-slate-800 text-white rounded-sm p-2">
        <Markdown
          options={{
            overrides: {
              code: {
                component: SyntaxHighlighter,
                props: {
                  style: atomOneDark,
                },
              },
              p: {
                component: "div",
              },
            },
          }}
          className={msg.type === "incoming" ? "text-left" : "text-end"}
        >
          {messageText.text}
        </Markdown>
      </div>
    );
  }

  useEffect(() => {
    intializeSocket(projectId);
    fetchProjectDetails();
    fetchAllUsers();
  
    recieveMessage("project-message", (data) => {
      let message;
  
      try {
        message = data.message ? JSON.parse(data.message) : null;
      } catch (error) {
        console.error("Invalid JSON message received:", data.message, error);
        message = null;
      }
  
      if (message?.fileTree) {
        setFileTree(message.fileTree);
      }
  
      appendIncomingMessage(data);
    });
  
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  

  useEffect(() => {
    if (!messageBox.current) return;
    scrollToBottom();
  }, [messages]);

  const appendIncomingMessage = (message) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { ...message, type: "incoming" },
    ]);
  };

  const appendOutgoingMessage = (message) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { message, sender: "Me", type: "outgoing" },
    ]);
  };

  const scrollToBottom = () => {
    if (!messageBox.current) return;
    messageBox.current.scrollTop = messageBox.current.scrollHeight;
  };

  // -----------------------------------------------------------

  const renderFileTree = (tree, depth = 0) => {
    return Object.keys(tree).map((key) => {
      const item = tree[key];
      const isFolder = item.children;
      return (
        <div key={key} className={`ml-${depth * 2} transition-all`}>
          <div
            className={`flex items-center gap-2 cursor-pointer px-3 py-1 rounded-md transition-all ${
              isFolder
                ? "text-yellow-400 hover:bg-yellow-800/20"
                : "text-blue-400 hover:bg-blue-800/20"
            }`}
            onClick={() => !isFolder && setSelectedFile(key)}
          >
            <i
              className={`text-lg ${
                isFolder ? "ri-folder-2-fill" : "ri-file-line"
              }`}
            ></i>
            <span className="font-medium">{key}</span>
          </div>
          {isFolder && (
            <div className="ml-4">
              {renderFileTree(item.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const getFileContents = (tree, filename) => {
    for (const key in tree) {
      if (tree[key].file.contents && key === filename) {
        return tree[key].file.contents;
      }
      if (tree[key].children) {
        const result = getFileContents(tree[key].children, filename);
        if (result) return result;
      }
    }
    return "";
  };

  const updateFileContents = (tree, filename, newContent) => {
    const newTree = { ...tree };
    const traverse = (node) => {
      for (const key in node) {
        if (key === filename && node[key].file.contents !== undefined) {
          node[key].file.contents = newContent;
          return;
        }
        if (node[key].children) traverse(node[key].children);
      }
    };
    traverse(newTree);
    return newTree;
  };

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
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message flex flex-col p-2 ${
                  msg.sender === "CodeAI" ? "max-w-80" : "max-w-56"
                } rounded-lg mb-2 m-2 ${
                  msg.type === "incoming"
                    ? "bg-slate-50"
                    : "bg-slate-500 text-white ml-auto"
                }`}
              >
                <small
                  className={`text-sm rounded-md w-fit px-2 mb-2 ${
                    msg.type === "incoming"
                      ? "bg-slate-800 text-white opacity-65"
                      : "bg-slate-800 text-white opacity-85"
                  }`}
                >
                  {msg.sender}
                </small>
                {msg.sender === "CodeAI" ? (
                  WriteAimessage(msg)
                ) : (
                  <p
                    className={
                      msg.type === "incoming" ? "text-left" : "text-end"
                    }
                  >
                    {msg.message}
                  </p>
                )}
              </div>
            ))}
          </div>
          {/* Input container */}
          <div className="input-container p-2 border-t absolute bottom-0 w-full z-10 bg-slate-200 border-slate-200">
            <div className="inputField w-full flex gap-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
              <input
                className="flex-grow p-2 px-4 border-none outline-none text-sm"
                type="text"
                placeholder="start with @ai to chat with AI"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessageHandler()}
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
          className={`sidepanel min-w-96 flex flex-col gap-2 h-screen bg-slate-300 absolute top-0 z-20  transition-all duration-300 ease-in-out ${
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

      <section className="right flex-grow h-full flex bg-slate-700">
        {/* File Explorer */}
        {fileTree && (
          <div className="explorer h-full min-w-56 bg-neutral-900 text-white p-3 overflow-auto">
            <h1 className="text-center font-semibold text-lg mb-3">
              📂 File Explorer
            </h1>
            <div className="file-tree">{renderFileTree(fileTree)}</div>
          </div>
        )}

        {/* Code Editor */}
        {selectedFile && (
          <div className="code-editor flex-grow h-full overflow-y-scroll bg-neutral-800 p-4">
            <h1 className="text-white font-semibold text-lg mb-3">
              📝 {selectedFile}
            </h1>
            <div className="code-editor-area p-1 rounded-lg bg-neutral-900 text-white shadow-lg">
              <SyntaxHighlighter
                wrapLines={true}
                contentEditable={true}
                suppressContentEditableWarning
                language={getSyntaxHighlighterLanguage(selectedFile)}
                spellCheck={false}
                style={atomOneDark}
                onBlur={(e) => {
                  const updatedContent = e.target.innerText;
                  setFileTree((prevFileTree) =>
                    updateFileContents(
                      prevFileTree,
                      selectedFile,
                      updatedContent
                    )
                  );
                }}
              >
                {getFileContents(fileTree, selectedFile)}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
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
