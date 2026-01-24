import React, { useState, useEffect } from 'react';
import { backend } from './services/backendService';
import { User, VideoTask, GenerationType } from './types';
import AuthPage from './components/auth/AuthPage';
import Layout from './components/ui/Layout';
import { PromptInput } from './components/dashboard/PromptInput';
import { VideoGrid } from './components/dashboard/VideoGrid';
import { ProjectsGrid } from './components/dashboard/ProjectsGrid';
import { SceneBuilder } from './components/scenebuilder/SceneBuilder';
import { Video, Image, FolderOpen, Search, Grid, LayoutGrid, Heart } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('Videos');
  const [view, setView] = useState<'dashboard' | 'scenebuilder'>('dashboard');
  const [sceneClips, setSceneClips] = useState<VideoTask[]>([]);
  const [currentProjectName, setCurrentProjectName] = useState<string>("Untitled Project");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectRefresh, setProjectRefresh] = useState(0);

  // Load session on mount
  useEffect(() => {
    const currentUser = backend.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadTasks(currentUser.id);
    }
  }, []);

  // Listen for task updates
  useEffect(() => {
    const handleUpdate = () => {
      if (user) {
        loadTasks(user.id).then((updatedTasks) => {
          if (view === 'scenebuilder' && updatedTasks) {
            const latest = updatedTasks[0];
            if (latest && latest.status === 'COMPLETED' && !sceneClips.find(c => c.id === latest.id)) {
              setSceneClips(prev => prev.map(clip =>
                clip.id === latest.id ? latest : clip
              ));
            }
          }
        });
      }
      setIsGenerating(false);
    };
    window.addEventListener('taskUpdated', handleUpdate);
    return () => window.removeEventListener('taskUpdated', handleUpdate);
  }, [user, view, sceneClips]);

  const loadTasks = async (userId: string) => {
    const t = await backend.getUserTasks(userId);
    setTasks(t);
    return t;
  };

  const handleLoginSuccess = () => {
    const currentUser = backend.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadTasks(currentUser.id);
    }
  };

  const handleLogout = () => {
    backend.logout();
    setUser(null);
    setTasks([]);
    setView('dashboard');
    setSceneClips([]);
  };

  const handleGenerate = async (type: GenerationType, prompt: string, model: string, ratio: string, imgBase64?: string) => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const newTask = await backend.createGenerationTask(user.id, type, prompt, model, ratio, imgBase64);
      loadTasks(user.id);
      if (view === 'scenebuilder') {
        setSceneClips(prev => [...prev, newTask]);
      }
    } catch (e) {
      console.error(e);
      setIsGenerating(false);
    }
  };

  const handleStopGeneration = () => {
    backend.cancelCurrentGeneration();
    setIsGenerating(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    if (confirm("Are you sure you want to delete this video?")) {
      await backend.deleteTask(taskId);
      loadTasks(user.id);
    }
  };

  const handleAddToScene = (task: VideoTask) => {
    setSceneClips(prev => {
      // Check jika clip sudah ada dalam scene (prevent duplicate)
      const alreadyInScene = prev.some(clip => clip.id === task.id);
      if (alreadyInScene) {
        console.log('Clip already in scene, skipping duplicate');
        return prev;
      }
      return [...prev, task];
    });
    // If adding to a clean slate (not editing a saved project), ensure we are in draft mode
    // NOTE: If user was editing a project and adds a clip, we might want to keep the project context.
    // For now, let's assume adding from dashboard *always* continues current session if we are not explicitly "Clearing".
    // But if sceneClips was empty, we can assume new project.
    if (sceneClips.length === 0) {
      setCurrentProjectName("Untitled Project");
      setCurrentProjectId(null);
    }
    setView('scenebuilder');
  };

  if (!user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  // --- VIEW: SCENEBUILDER ---
  if (view === 'scenebuilder') {
    return (
      <SceneBuilder
        initialClips={sceneClips}
        onBack={() => {
          setView('dashboard');
          // Optional: refresh projects grid when coming back
          setProjectRefresh(prev => prev + 1);
        }}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        onStopGeneration={handleStopGeneration}
        onUpdateClips={setSceneClips}
        initialProjectName={currentProjectName}
        initialProjectId={currentProjectId}
      />
    );
  }

  // --- VIEW: DASHBOARD ---
  return (
    <Layout
      user={user}
      onLogout={handleLogout}
      onNavigateToSceneBuilder={() => {
        // If navigating manually, maybe keep session or clear?
        // Let's keep session for now
        setView('scenebuilder');
      }}
    >
      {/* Sub Navigation / Filters */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('Videos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'Videos' ? 'bg-[#1f1f1f] text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Video size={16} /> Videos
          </button>
          <button
            onClick={() => setActiveTab('Images')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'Images' ? 'bg-[#1f1f1f] text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Image size={16} /> Images
          </button>
          <button
            onClick={() => setActiveTab('Projects')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'Projects' ? 'bg-[#1f1f1f] text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <FolderOpen size={16} /> Projects
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Telusuri klip"
              className="bg-[#141414] border border-[#222] rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 w-64"
            />
          </div>
          <div className="flex items-center bg-[#141414] rounded-lg p-1 border border-[#222]">
            <button className="p-1.5 rounded hover:bg-white/10 text-white"><Grid size={16} /></button>
            <button className="p-1.5 rounded hover:bg-white/10 text-gray-500"><LayoutGrid size={16} /></button>
          </div>
          <button className="p-2 hover:text-white text-gray-400"><Heart size={18} /></button>
        </div>
      </div>

      {activeTab === 'Videos' && (
        <VideoGrid
          tasks={tasks}
          onDelete={handleDeleteTask}
          onAddToScene={handleAddToScene}
        />
      )}

      {activeTab === 'Projects' && (
        <ProjectsGrid
          onSelectProject={async (projectId) => {
            try {
              const project = await backend.getProjectById(projectId);
              if (project) {
                let projectClips: VideoTask[] = [];
                try {
                  const parsed = JSON.parse(project.clipsJson);

                  if (Array.isArray(parsed) && parsed.length > 0) {
                    // Check format: Array of strings (Legacy) or Objects (New)
                    if (typeof parsed[0] === 'string') {
                      // Legacy: ["id1", "id2"]
                      const clipIds = parsed as string[];
                      projectClips = clipIds.map(id => tasks.find(t => t.id === id)).filter(Boolean) as VideoTask[];
                    } else {
                      // New: [{id: "...", trimStart: 0, trimEnd: 5}, ...]
                      const clipData = parsed as { id: string, trimStart?: number, trimEnd?: number }[];
                      projectClips = clipData.map(data => {
                        const task = tasks.find(t => t.id === data.id);
                        if (!task) return null;
                        return {
                          ...task,
                          trimStart: data.trimStart,
                          trimEnd: data.trimEnd
                        };
                      }).filter(Boolean) as VideoTask[];
                    }
                  }
                } catch (e) {
                  console.error("Failed to parse clips JSON", e);
                }

                setSceneClips(projectClips);
                setCurrentProjectName(project.name);
                setCurrentProjectId(project.id);
                setView('scenebuilder');
              }
            } catch (error) {
              console.error("Failed to load project:", error);
              alert("Failed to load project");
            }
          }}
          refreshTrigger={projectRefresh}
        />
      )}

      <PromptInput
        onGenerate={handleGenerate}
        onStop={handleStopGeneration}
        isGenerating={isGenerating}
      />
    </Layout>
  );
};

export default App;
