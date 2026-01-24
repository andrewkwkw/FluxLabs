import React, { useEffect, useState } from 'react';
import { Trash2, Play, MoreVertical, FolderOpen } from 'lucide-react';
import { backend } from '../../services/backendService';

interface ProjectsGridProps {
  onSelectProject: (projectId: string) => void;
  refreshTrigger?: number;
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ onSelectProject, refreshTrigger }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, [refreshTrigger]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await backend.getProjects();
      setProjects(data || []);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (confirm("Delete this project?")) {
      try {
        await backend.deleteProject(projectId);
        loadProjects();
      } catch (error) {
        console.error("Failed to delete project:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 pb-32">
        <div className="h-20 w-20 rounded-2xl bg-[#141414] border border-white/5 flex items-center justify-center mb-4">
          <FolderOpen size={32} className="opacity-50" />
        </div>
        <h3 className="text-gray-400 font-medium mb-1">No Projects Yet</h3>
        <p className="text-xs text-gray-600">Create a new scene in SceneBuilder and save it</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-40">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <div 
            key={project.id} 
            className="group relative bg-[#141414] rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300"
          >
            {/* Thumbnail Area */}
            <div className="aspect-video bg-black relative flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-[#4a2b8a] flex items-center justify-center">
                  <FolderOpen size={20} className="text-white" />
                </div>
                <span className="text-xs text-gray-400">Scene Project</span>
              </div>

              {/* Overlay on Hover */}
              <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50 flex items-center justify-center z-20">
                <button
                  onClick={() => onSelectProject(project.id)}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  <Play size={14} />
                  Open
                </button>
              </div>

              {/* Top Right Actions */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2 z-20">
                <button
                  onClick={() => handleDelete(project.id)}
                  className="h-8 w-8 rounded-full bg-[#f5e6d3] hover:bg-red-200 text-black hover:text-red-600 flex items-center justify-center shadow-lg transition active:scale-95"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="p-3 bg-[#141414]">
              <h3 className="text-sm font-medium text-gray-200 truncate">{project.name}</h3>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(project.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
