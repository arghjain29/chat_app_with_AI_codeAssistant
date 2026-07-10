import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../context/userContext.jsx";
import { ToastContext } from "../components/ToastContext.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Markdown from "markdown-to-jsx";
import {
  intializeSocket,
  recieveMessage,
  sendMessage,
} from "../config/socket.js";
import axios from "../config/axios.js";
import { getWebContainer } from "../config/webContainer.js";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";

function getLanguageExtension(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    switch (ext) {
        case "js": return javascript();
        case "jsx": return javascript({ jsx: true });
        case "ts": return javascript({ typescript: true });
        case "tsx": return javascript({ jsx: true, typescript: true });
        case "html": case "htm": return html();
        case "css": return css();
        case "json": return json();
        default: return javascript();
    }
}

function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

const Project = () => {
  const [webContainer, setWebContainer] = useState(null);
  const editorRef = useRef(null);
  const editorViewRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const { toast } = useContext(ToastContext);
  const projectId = location.state?.id;
  const messageBox = useRef(null);

  const [leftPanel, setLeftPanel] = useState(false);
  const [addUserModal, setAddUserModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState([]);
  const [fetchedUser, setFetchedUser] = useState([]);
  const [projectCollabs, setProjectCollabs] = useState([]);
  const [thisProject, setThisProject] = useState({});
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [fileTree, setFileTree] = useState(null);
  const [runProcess, setRunProcess] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveUserConfirm, setShowRemoveUserConfirm] = useState(null);

  const closeModal = () => {
    setAddUserModal(false);
    setSelectedUserId([]);
  };

  const scrollToBottom = useCallback(() => {
    if (!messageBox.current) return;
    messageBox.current.scrollTop = messageBox.current.scrollHeight;
  }, []);

  const handleAddCollaborator = async () => {
    try {
      const res = await axios.put("/api/projects/add-user", {
        users: selectedUserId,
        projectId,
      });
      toast.success(res.data.message);
      fetchProjectDetails();
      closeModal();
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to add collaborators";
      toast.error(msg);
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await axios.put("/api/projects/remove-user", {
        userId,
        projectId,
      });
      toast.success("Collaborator removed");
      fetchProjectDetails();
      setShowRemoveUserConfirm(null);
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to remove collaborator";
      toast.error(msg);
    }
  };

  const handleRenameProject = async () => {
    if (!editProjectName || editProjectName.length < 3) {
      toast.error("Name must be at least 3 characters");
      return;
    }
    try {
      await axios.put(`/api/projects/update-project/${projectId}`, { name: editProjectName });
      toast.success("Project renamed");
      setThisProject({ ...thisProject, name: editProjectName });
      setShowSettings(false);
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to rename project";
      toast.error(msg);
    }
  };

  const handleDeleteProject = async () => {
    try {
      await axios.delete(`/api/projects/delete-project/${projectId}`);
      toast.success("Project deleted");
      navigate("/");
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to delete project";
      toast.error(msg);
    }
    setShowDeleteConfirm(false);
  };

  const handleSelection = (userId) => () => {
    setSelectedUserId((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      return [...prev, userId];
    });
  };

  const fetchAllUsers = async () => {
    try {
      const res = await axios.get("/api/users/all");
      setFetchedUser(res.data);
    } catch (error) {
      console.error("[Project] Failed to load users");
    }
  };

  const fetchProjectDetails = async () => {
    try {
      const res = await axios.get(`/api/projects/get-project/${projectId}`);
      setThisProject(res.data);
      setProjectCollabs(res.data.users);
      setEditProjectName(res.data.name);
    } catch (error) {
      toast.error("Failed to load project details");
      navigate("/");
    }
  };

  const sendMessageHandler = () => {
    if (message === "") return;
    sendMessage("project-message", { message, sender: user.username, timestamp: Date.now() });
    appendOutgoingMessage(message);
    setMessage("");
  };

  function WriteAimessage(msg) {
    let messageText;
    try {
      messageText = JSON.parse(msg.message);
    } catch {
      return <p className="text-sm">{msg.message}</p>;
    }
    return (
      <div className="overflow-auto text-sm">
        <Markdown
          options={{
            overrides: {
              code: {
                component: ({ children, className }) => {
                  const isBlock = className && className.includes('language-');
                  if (!isBlock) return <code className="bg-slate-700 px-1 rounded text-sm">{children}</code>;
                  return (
                    <pre className="bg-slate-900 p-2 rounded text-xs overflow-x-auto">
                      <code>{children}</code>
                    </pre>
                  );
                },
              },
              p: { component: "div" },
            },
          }}
        >
          {messageText.text || ""}
        </Markdown>
        {messageText.fileTree && (
          <div className="mt-2 p-2 bg-slate-700 rounded text-xs">
            <p className="text-green-400 font-mono">Files created: {Object.keys(messageText.fileTree).join(", ")}</p>
          </div>
        )}
      </div>
    );
  }

  function transformToWebContainerTree(fileTree, rootName = "myproject") {
    function transformNode(node) {
      if (node.children && Object.keys(node.children).length > 0) {
        return {
          directory: Object.fromEntries(
            Object.entries(node.children).map(([key, value]) => [key, transformNode(value)])
          ),
        };
      } else if (node.file && node.file.contents !== undefined) {
        return { file: { contents: node.file.contents } };
      }
      return {};
    }
    return {
      [rootName]: {
        directory: Object.fromEntries(
          Object.entries(fileTree).map(([key, value]) => [key, transformNode(value)])
        ),
      },
    };
  }

  useEffect(() => {
    if (!projectId) {
      navigate("/");
      return;
    }
    intializeSocket(projectId);
    fetchProjectDetails();
    fetchAllUsers();

    if (!webContainer) {
      getWebContainer().then((container) => {
        setWebContainer(container);
      });
    }

    recieveMessage("project-message", async (data) => {
      let message;
      try {
        message = data.message ? JSON.parse(data.message) : null;
      } catch {
        message = null;
      }
      if (message?.fileTree) {
        setFileTree(message.fileTree);
        const webContainerTree = transformToWebContainerTree(message.fileTree);
        const container = webContainer || (await getWebContainer());
        if (container) {
          try {
            await container.mount(webContainerTree);
          } catch (err) {
            console.error("[Project] WebContainer mount failed:", err);
          }
        }
      }
      appendIncomingMessage(data);
    });

    return () => {
      if (runProcess) runProcess.kill();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // CodeMirror effect
  useEffect(() => {
    if (!selectedFile || !fileTree || !editorRef.current) return;

    const content = getFileContents(fileTree, selectedFile);
    const language = getLanguageExtension(selectedFile);

    if (editorViewRef.current) {
        editorViewRef.current.destroy();
    }

    const state = EditorState.create({
        doc: content,
        extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            history(),
            foldGutter(),
            highlightActiveLine(),
            keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                ...closeBracketsKeymap,
            ]),
            language,
            oneDark,
            bracketMatching(),
            closeBrackets(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    const newContent = update.state.doc.toString();
                    setFileTree((prev) => updateFileContents(prev, selectedFile, newContent));
                }
            }),
            EditorView.theme({
                "&": { height: "100%" },
                ".cm-scroller": { overflow: "auto" },
            }),
        ],
    });

    editorViewRef.current = new EditorView({
        state,
        parent: editorRef.current,
    });

    return () => {
        if (editorViewRef.current) {
            editorViewRef.current.destroy();
            editorViewRef.current = null;
        }
    };
  }, [selectedFile, fileTree]);

  const appendIncomingMessage = (message) => {
    setMessages((prev) => [...prev, { ...message, type: "incoming" }]);
  };

  const appendOutgoingMessage = (message) => {
    setMessages((prev) => [...prev, { message, sender: "Me", type: "outgoing", timestamp: Date.now() }]);
  };

  const renderFileTree = (tree, depth = 0) => {
    return Object.keys(tree).map((key) => {
      const item = tree[key];
      const isFolder = item.children;
      return (
        <div key={key} style={{ marginLeft: depth * 12 }}>
          <div
            className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded-md text-sm transition-all ${
              isFolder
                ? "text-yellow-400 hover:bg-yellow-800/20"
                : "text-blue-400 hover:bg-blue-800/20"
            } ${selectedFile === key && !isFolder ? "bg-blue-800/30" : ""}`}
            onClick={() => !isFolder && setSelectedFile(key)}
          >
            <i className={`text-sm ${isFolder ? "ri-folder-2-fill" : "ri-file-line"}`}></i>
            <span>{key}</span>
          </div>
          {isFolder && (
            <div>{renderFileTree(item.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const getFileContents = (tree, filename) => {
    for (const key in tree) {
      if (tree[key].file?.contents && key === filename) return tree[key].file.contents;
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
        if (key === filename && node[key].file?.contents !== undefined) {
          node[key] = { ...node[key], file: { ...node[key].file, contents: newContent } };
          return;
        }
        if (node[key].children) traverse(node[key].children);
      }
    };
    traverse(newTree);
    return newTree;
  };

  const isOwner = user && projectCollabs.length > 0 && projectCollabs[0]._id === user._id;

  return (
    <main className="h-screen w-screen flex flex-col">
      {/* Top bar */}
      <header className="h-10 bg-slate-800 flex items-center justify-between px-3 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-slate-400 hover:text-white transition-colors text-sm">
            <i className="ri-arrow-left-line"></i>
          </button>
          <span className="text-white font-medium text-sm">{thisProject.name || "Project"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSettings(true); setEditProjectName(thisProject.name); }}
            className="text-slate-400 hover:text-white transition-colors text-sm px-2 py-1 rounded hover:bg-slate-700"
          >
            <i className="ri-settings-3-line"></i>
          </button>
        </div>
      </header>

      <div className="flex flex-grow overflow-hidden">
        {/* Left section - Chat */}
        <section className="relative flex flex-col h-full min-w-80 max-w-md bg-slate-100 border-r border-slate-200">
          <div className="flex select-none justify-between items-center p-2 px-3 bg-white border-b border-slate-200 shrink-0">
            <button
              onClick={() => setAddUserModal(true)}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <i className="ri-add-fill"></i>
              <span className="font-medium">Add collaborator</span>
            </button>
            <button
              onClick={() => setLeftPanel(true)}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md transition-colors"
            >
              <i className="ri-group-fill"></i>
            </button>
          </div>

          <div className="flex-grow flex flex-col bg-slate-300 overflow-hidden">
            <div ref={messageBox} className="message-box flex flex-col flex-grow overflow-y-auto scroll-smooth p-2 gap-2">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <i className="ri-chat-3-line text-3xl mb-2"></i>
                  <p className="text-sm">Send a message or start with @ai</p>
                </div>
              )}
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.sender === "CodeAI" ? "max-w-full" : "max-w-xs"} ${
                    msg.type === "incoming" ? "self-start" : "self-end"
                  }`}
                >
                  <div className={`rounded-lg p-2 ${
                    msg.type === "incoming"
                      ? msg.sender === "CodeAI" ? "bg-slate-800 text-white" : "bg-slate-50"
                      : "bg-slate-500 text-white"
                  }`}>
                    {msg.sender !== "Me" && (
                      <small className={`text-xs font-medium block mb-1 px-1 ${
                        msg.sender === "CodeAI" ? "text-blue-400" : "text-slate-500"
                      }`}>
                        {msg.sender}
                      </small>
                    )}
                    {msg.sender === "CodeAI" ? (
                      WriteAimessage(msg)
                    ) : (
                      <p className="text-sm">{msg.message}</p>
                    )}
                  </div>
                  {msg.timestamp && (
                    <span className="text-xs text-slate-400 mt-0.5 px-1">{formatTime(msg.timestamp)}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="p-2 border-t bg-slate-200 border-slate-200 shrink-0">
              <div className="flex gap-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
                <input
                  className="flex-grow p-2 px-3 border-none outline-none text-sm"
                  type="text"
                  placeholder="Type a message... (@ai for AI)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessageHandler()}
                />
                <button
                  className="px-3 text-slate-600 hover:text-slate-900 transition-colors"
                  onClick={sendMessageHandler}
                >
                  <i className="ri-send-plane-fill"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Collaborator side panel */}
          <div
            className={`absolute inset-y-0 w-72 flex flex-col bg-slate-100 border-r border-slate-200 z-20 transition-transform duration-300 ${
              leftPanel ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex justify-between items-center p-3 bg-white border-b border-slate-200">
              <h1 className="text-sm font-semibold">Collaborators ({projectCollabs.length})</h1>
              <button onClick={() => setLeftPanel(false)} className="text-slate-400 hover:text-slate-700">
                <i className="ri-close-fill"></i>
              </button>
            </div>
            <div className="flex flex-col gap-1 p-2 overflow-auto">
              {projectCollabs.map((collab) => (
                <div
                  key={collab._id}
                  className="flex items-center justify-between p-2 rounded-md bg-white hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs">
                      {collab.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{collab.username}</p>
                      {collab._id === user?._id && <p className="text-xs text-slate-400">You</p>}
                    </div>
                  </div>
                  {isOwner && collab._id !== user?._id && (
                    <button
                      onClick={() => setShowRemoveUserConfirm(collab._id)}
                      className="text-slate-400 hover:text-red-500 transition-colors text-xs"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right section - Code */}
        <section className="flex flex-grow h-full overflow-hidden bg-slate-900">
          {fileTree && (
            <div className="w-48 bg-neutral-900 text-white p-2 overflow-auto border-r border-slate-700 shrink-0">
              <h1 className="text-center font-semibold text-xs mb-2 text-slate-400 uppercase tracking-wide">Files</h1>
              <div className="file-tree">{renderFileTree(fileTree)}</div>
            </div>
          )}

          {selectedFile && fileTree && (
            <div className="flex flex-col flex-grow overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-800 border-b border-slate-700 shrink-0">
                <span className="text-white text-sm font-medium">{selectedFile}</span>
                <div className="flex items-center gap-1">
                  <button
                    className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    onClick={async () => {
                      if (!webContainer) return toast.error("WebContainer not ready");
                      if (runProcess) runProcess.kill();
                      try {
                        const tempRun = await webContainer.spawn("npm", ["start"], { cwd: "/myproject" });
                        tempRun.output.pipeTo(new WritableStream({ write(chunk) { console.log(chunk); } }));
                        setRunProcess(tempRun);
                        webContainer.on("server-ready", (port, url) => setIframeUrl(url));
                        toast.success("Server starting...");
                      } catch (err) {
                        toast.error("Failed to start server");
                      }
                    }}
                    title="Start server"
                  >
                    <i className="ri-play-fill"></i>
                  </button>
                  <button
                    className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    onClick={async () => {
                      if (!webContainer) return toast.error("WebContainer not ready");
                      try {
                        const install = await webContainer.spawn("npm", ["install"], { cwd: "/myproject" });
                        install.output.pipeTo(new WritableStream({ write(chunk) { console.log(chunk); } }));
                        toast.success("Installing dependencies...");
                      } catch (err) {
                        toast.error("Failed to install");
                      }
                    }}
                    title="Install dependencies"
                  >
                    <i className="ri-download-2-line"></i>
                  </button>
                </div>
              </div>
              <div ref={editorRef} className="flex-grow overflow-hidden"></div>
            </div>
          )}

          {!selectedFile && fileTree && (
            <div className="flex flex-col items-center justify-center flex-grow text-slate-500">
              <i className="ri-file-code-line text-4xl mb-2"></i>
              <p>Select a file to view</p>
            </div>
          )}

          {!fileTree && (
            <div className="flex flex-col items-center justify-center flex-grow text-slate-500">
              <i className="ri-code-s-slash-line text-5xl mb-3"></i>
              <p className="text-lg">Start a chat with @ai to generate code</p>
              <p className="text-sm text-slate-400 mt-1">The file explorer will appear here</p>
            </div>
          )}

          {iframeUrl && webContainer && (
            <div className="flex flex-col h-full w-full md:w-1/2 border-l border-slate-700 bg-neutral-900">
              <div className="flex items-center gap-2 p-1.5 bg-slate-800 border-b border-slate-700 shrink-0">
                <input
                  type="text"
                  value={iframeUrl}
                  onChange={(e) => setIframeUrl(e.target.value)}
                  className="flex-1 p-1.5 px-3 bg-slate-700 text-white text-xs rounded outline-none border border-slate-600"
                />
                <button
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors"
                  onClick={() => setIframeUrl(iframeUrl + "/")}
                >
                  <i className="ri-refresh-line"></i>
                </button>
              </div>
              <iframe src={iframeUrl} className="flex-grow bg-white border-none"></iframe>
            </div>
          )}
        </section>
      </div>

      {/* Add user modal */}
      {addUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-30" onClick={closeModal}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add Collaborator</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="flex flex-col max-h-64 overflow-auto gap-1">
              {fetchedUser.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No other users found</p>}
              {fetchedUser.map((u) => (
                <div
                  key={u._id}
                  onClick={handleSelection(u._id)}
                  className={`flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-2 rounded-md transition-colors ${
                    selectedUserId.includes(u._id) ? "bg-blue-50 border border-blue-200" : "bg-slate-50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs">
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{u.username}</span>
                  {selectedUserId.includes(u._id) && <i className="ri-check-line text-blue-500 ml-auto"></i>}
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-4">
              <button
                onClick={handleAddCollaborator}
                disabled={selectedUserId.length === 0}
                className="min-w-40 bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
              >
                Add {selectedUserId.length > 0 ? `(${selectedUserId.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-30" onClick={() => setShowSettings(false)}>
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Project Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-700">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={handleRenameProject}
                  className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                >
                  Rename
                </button>
              </div>
            </div>

            {isOwner && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Danger Zone</p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                >
                  Delete Project
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete project confirm */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Project"
        message="This will permanently delete this project and all its data. This action cannot be undone."
        onConfirm={handleDeleteProject}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Delete Project"
      />

      {/* Remove user confirm */}
      <ConfirmModal
        isOpen={!!showRemoveUserConfirm}
        title="Remove Collaborator"
        message="Are you sure you want to remove this collaborator from the project?"
        onConfirm={() => handleRemoveUser(showRemoveUserConfirm)}
        onCancel={() => setShowRemoveUserConfirm(null)}
        confirmText="Remove"
      />
    </main>
  );
};

export default Project;
