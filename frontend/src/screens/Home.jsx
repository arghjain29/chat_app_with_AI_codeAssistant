/* eslint-disable react-hooks/exhaustive-deps */
import { useContext, useState, useEffect } from "react";
import { UserContext } from "../context/userContext.jsx";
import { useNavigate } from "react-router-dom";
import axios from "../config/axios.js";

const Home = () => {
  useContext(UserContext);
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState(""); // project name for modal
  const [projects, setProjects] = useState([]); // this contains all the projects after fetching

  useEffect(
    () => {
      getProjects();
    },
    [
      /* dependencies */
    ]
  );

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

  const getProjects = async () => {
    try {
      const response = await axios.get("/api/projects/all");
      console.log(response.data);
      setProjects(response.data);
    } catch (error) {
      console.error(error.response.data);
    }
  };

  return (
    <main className="p-4">
      <div className="projects flex flex-wrap gap-3">
        <button
          onClick={() => {
            setIsModalOpen(true);
          }}
          className="project p-4 border rounded-md border-slate-300 hover:border-slate-400 flex items-center justify-between mb-4 shadow-md"
        >
          <i className="ri-links-fill mr-1"></i>
          New Project
        </button>

        {projects.map((project) => (
          <div
            key={project._id}
            onClick={() => {
              navigate(`/project`, { state: { id: project._id } });
            }} // navigate to project page
            className="project p-4 border rounded-md border-slate-300 hover:border-slate-400 flex flex-col gap-2 items-center justify-between mb-4 cursor-pointer bg-white shadow-md min-w-52 hover:bg-slate-100 "
          >
            <span className="text-lg flex gap-2">
              <i className="ri-folder-shared-line"></i>
              {project.name}
            </span>
            <div className="flex text-gray-600">
              <p>
                <i className="ri-user-3-line mr-1"></i>Collaborators:{" "}
                {project.users.length}{" "}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="modal-content w-1/3 bg-white p-6 rounded-md shadow-lg">
            <h2 className="text-2xl mb-4 font-bold">New Project</h2>
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
