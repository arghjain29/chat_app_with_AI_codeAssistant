import { useContext, useState } from "react";
import { UserContext } from "../context/user.context.jsx";
import axios from "../config/axios.js";

const Home = () => {
  useContext(UserContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");

  const createProject = async (e) => {
    e.preventDefault();
    if (!projectName) {
      alert("Please enter a project name");
      return;
    }

    try {
      const response = await axios.post("/api/projects/create", {
        name: projectName,
      });
      if (response.status === 400) {
        alert(response.data.message);
      }
      if (response.status === 201) {
        console.log(response);
        setIsModalOpen(false);
        setProjectName("");
      }
    } catch (error) {
      console.error(error.response.data);
    }
  };

  return (
    <main className="p-4">
      <div className="projects">
        <button
          onClick={() => {
            setIsModalOpen(true);
          }}
          className="project p-4 border rounded-md border-slate-300 hover:border-slate-400 flex items-center justify-between mb-4"
        >
          <i className="ri-links-fill mr-1"></i>
          New Project
        </button>
      </div>

      {isModalOpen && (
        <div className="modal fixed inset-0  flex items-center justify-center bg-black bg-opacity-50">
          <div className="modal-content w-1/4 bg-white p-6 rounded-md">
            <h2 className="text-xl mb-4">New Project</h2>
            <form onSubmit={createProject}>
              <div className="mb-4">
                <label
                  htmlFor="projectName"
                  className="block text-sm font-medium mb-2 text-gray-700"
                >
                  Project Name
                </label>
                <input
                  type="text"
                  onChange={(e) => setProjectName(e.target.value)}
                  value={projectName}
                  id="projectName"
                  name="projectName"
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="mr-2 px-4 py-2 bg-gray-300 rounded-md"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default Home;
