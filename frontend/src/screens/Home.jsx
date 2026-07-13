import { useContext, useState, useEffect, useMemo } from "react";
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
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    return projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [projects, search]);

  const totalCollabs = projects.reduce((sum, p) => sum + (p.users?.length || 0), 0);

  let content;
  if (loading) {
    content = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
            <div className="flex gap-2">
              <div className="h-8 bg-slate-200 rounded w-16"></div>
              <div className="h-8 bg-slate-200 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  } else if (filtered.length === 0) {
    content = (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
        {search ? (
          <>
            <i className="ri-search-eye-line text-6xl mb-4"></i>
            <p className="text-lg font-medium text-slate-500">No projects for &ldquo;{search}&rdquo;</p>
            <button onClick={() => setSearch("")} className="mt-3 text-sm text-blue-600 hover:text-blue-700 transition-colors">
              Clear search
            </button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <i className="ri-folder-add-line text-4xl text-blue-500"></i>
            </div>
            <p className="text-lg font-medium text-slate-600">No projects yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">Create your first project to get started</p>
            <button
              onClick={() => { setIsModalOpen(true); setErrors({}); }}
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <i className="ri-add-line mr-1"></i>Create Project
            </button>
          </>
        )}
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project, idx) => (
          <div
            key={project._id}
            onClick={() => navigate(`/project`, { state: { id: project._id } })}
            className="group bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 animate-fade-in-up"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
                <i className="ri-folder-2-line text-xl"></i>
              </div>
              <span className="text-xs text-slate-400">
                <i className="ri-time-line mr-1"></i>
                {new Date(project.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <h3 className="font-semibold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
              {project.name}
            </h3>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <i className="ri-user-3-line"></i>
                {project.users.length} {project.users.length === 1 ? "collaborator" : "collaborators"}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />
      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Welcome back, <span className="text-blue-600">{user?.username}</span>
            </h1>
            <p className="text-slate-500 mt-1">Manage your collaboration projects</p>
          </div>
          <button
            onClick={() => { setIsModalOpen(true); setErrors({}); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <i className="ri-add-line"></i>
            New Project
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <i className="ri-folder-2-line text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Projects</p>
                <p className="text-2xl font-bold text-slate-800">{projects.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                <i className="ri-team-line text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-slate-500">Collaborators</p>
                <p className="text-2xl font-bold text-slate-800">{totalCollabs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                <i className="ri-flashlight-line text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-slate-500">Active Now</p>
                <p className="text-2xl font-bold text-slate-800">{projects.length > 0 ? "Ready" : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <i className="ri-close-line"></i>
            </button>
          )}
        </div>

        {content}

        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={() => setIsModalOpen(false)}>
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Create Project</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
              <form onSubmit={createProject}>
                <div className="mb-5">
                  <label htmlFor="projectName" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Project Name
                  </label>
                  <input
                    type="text"
                    onChange={(e) => setProjectName(e.target.value)}
                    value={projectName}
                    id="projectName"
                    name="projectName"
                    placeholder="e.g. My Awesome App"
                    className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    autoFocus
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {creating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="ri-add-line"></i>
                        Create
                      </>
                    )}
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
