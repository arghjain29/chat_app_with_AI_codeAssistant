/* eslint-disable react/prop-types */
import { useLocation } from "react-router-dom";
const Project = () => {
  const location = useLocation();

  console.log(location.state);

  return (
    <main className="h-screen w-screen flex">
      <section className="left relative flex flex-col h-screen min-w-96 bg-slate-100 border-r border-slate-200">
        <header className="flex justify-between items-center p-2 px-4 w-full bg-white border-b border-slate-200">
          <button className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <i className="ri-add-fill"></i>
            <span>Add collaborator</span>
          </button>
          <button className="p-2 text-slate-600 hover:text-slate-900 rounded-md transition duration-300 ease-in-out">
            <i className="ri-group-fill"></i>
          </button>
        </header>

        <div className="conversation-area flex-grow flex flex-col bg-slate-300">
          <div className="message-box flex-grow flex-col">
            {/* Message content would go here */}
            <div className="incoming message flex flex-col p-2 bg-slate-50 max-w-56 rounded-lg mb-3 m-2">
              <small className="text-end bg-slate-800 text-sm rounded-md w-fit px-2 text-white opacity-65 mb-2">
                Username
              </small>
              <p className="text-left">
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
              </p>
            </div>
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
      </section>

      <section className="right flex-grow bg-slate-200">
        {/* Main content area */}
      </section>
    </main>
  );
};

export default Project;
