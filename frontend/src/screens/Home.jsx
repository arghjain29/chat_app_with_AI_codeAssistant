/* eslint-disable react-hooks/exhaustive-deps */
import { useContext, useState, useEffect } from "react";
import { UserContext } from "../context/userContext.jsx";
import { useNavigate } from "react-router-dom";
import axios from "../config/axios.js";
import { ToastContext } from "../components/ToastContext.jsx";
import Navbar from "../components/Navbar.jsx";

const Home = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const { toast } = useContext(ToastContext);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    getProjects();
  }, []);

  const createProject = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!projectName || projectName.length < 3) {
      setErrors({ name: "Project name must be at least 3 characters" });
      return;
    }

    setCreating(true);
    try {
      await axios.post("/api/projects/create", { name: projectName });
      toast.success("Project created");
      setIsModalOpen(false);
      setProjectName("");
      getProjects();
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || "Failed to create project";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const getProjects = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/projects/all");
      setProjects(response.data);
    } catch (error) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="p-4 max-w-7xl mx-auto">
        <div className="projects flex flex-wrap gap-3">
          <button
            onClick={() => {
              setIsModalOpen(true);
              setErrors({});
            }}
            className="project p-4 border rounded-md border-slate-300 hover:border-slate-400 flex items-center justify-between mb-4 shadow-md"
          >
            <i className="ri-links-fill mr-1"></i>
            New Project
          </button>

          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="project p-4 border rounded-md border-slate-200 flex flex-col gap-2 items-center mb-4 bg-white shadow-md min-w-52 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-24"></div>
                <div className="h-4 bg-slate-200 rounded w-20"></div>
              </div>
            ))
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 w-full">
              <i className="ri-folder-add-line text-5xl mb-3"></i>
              <p className="text-lg">No projects yet. Create your first project!</p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project._id}
                onClick={() => {
                  navigate(`/project`, { state: { id: project._id } });
                }}
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
            ))
          )}
        </div>

        {isModalOpen && (
          <div className="modal fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="modal-content w-full max-w-md mx-4 bg-white p-6 rounded-md shadow-lg">
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
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
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
                    disabled={creating}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
