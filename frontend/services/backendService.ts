
import { SETTINGS } from '../config';
import { User, VideoTask, GenerationStatus, GenerationType } from '../types';

// API URL - Auto detect ngrok atau localhost
const getAPIBase = () => {
  // Check if we're running through ngrok (hostname bukan localhost)
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  // Jika via ngrok/remote, gunakan same origin untuk API
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Backend harus running di same host (via ngrok)
    return `${protocol}//${hostname}`;
  }
  
  // Local development - use localhost:3001
  return 'http://localhost:3001';
};

const API_BASE = getAPIBase();
const API_URL = `${API_BASE}/api`;

console.log('[BackendService] API_BASE:', API_BASE);

class BackendService {
  
  // --- Auth ---

  private getAuthHeader() {
    const userStr = localStorage.getItem('fluxlabs_current_user');
    if (!userStr) return {};
    const user = JSON.parse(userStr);
    return {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
    };
  }

  async register(name: string, email: string, password: string): Promise<User> {
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Registration failed');
        }

        const data = await res.json();
        this.saveSession(data.user);
        return data.user;
    } catch (e: any) {
        console.error('[Register Error]', e.message);
        throw e;
    }
  }

  async login(email: string, password: string): Promise<User> {
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Login failed');
        }

        const data = await res.json();
        this.saveSession(data.user);
        return data.user;
    } catch (e: any) {
        console.error('[Login Error]', e.message);
        throw e;
    }
  }

  logout() {
    localStorage.removeItem('fluxlabs_current_user');
  }

  getCurrentUser(): User | null {
    const u = localStorage.getItem('fluxlabs_current_user');
    return u ? JSON.parse(u) : null;
  }

  private saveSession(user: User) {
    localStorage.setItem('fluxlabs_current_user', JSON.stringify(user));
  }

  // --- Generation ---

  async getUserTasks(userId: string): Promise<VideoTask[]> {
    try {
        const res = await fetch(`${API_URL}/tasks`, {
            headers: this.getAuthHeader() as HeadersInit
        });
        if (!res.ok) return []; // Return empty if unauthorized or error
        return await res.json();
    } catch (e) {
        console.error("Failed to fetch tasks", e);
        return [];
    }
  }

  async createGenerationTask(
    userId: string, 
    type: GenerationType, 
    prompt: string, 
    model: string, 
    ratio: string, 
    imgBase64?: string
  ): Promise<VideoTask> {
    
    // Kirim request ke Backend Database
    const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: this.getAuthHeader() as HeadersInit,
        body: JSON.stringify({
            type,
            prompt,
            model,
            ratio,
            thumbnail_url: imgBase64 // Kirim base64 gambar jika ada
        })
    });

    if (!res.ok) {
        throw new Error("Failed to create task");
    }

    const newTask = await res.json();

    // Trigger update UI setelah beberapa detik untuk simulasi selesai (Polling simple)
    // Di real production, gunakan WebSocket atau Server-Sent Events
    setTimeout(() => {
        window.dispatchEvent(new Event('taskUpdated'));
    }, 5500);

    return newTask;
  }

  async deleteTask(taskId: string) {
    await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader() as HeadersInit
    });
  }

  cancelCurrentGeneration() {
    // Di implementasi API sederhana ini, kita belum handle cancel request ke server
    console.log("Cancel functionality not yet implemented on server side.");
  }

  // --- PROJECTS ---

  async saveProject(name: string, clipsJson: string): Promise<any> {
    const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: this.getAuthHeader() as HeadersInit,
        body: JSON.stringify({ name, clipsJson })
    });
    if (!res.ok) throw new Error("Failed to save project");
    return await res.json();
  }

  async getProjects(): Promise<any[]> {
    try {
        const res = await fetch(`${API_URL}/projects`, {
            headers: this.getAuthHeader() as HeadersInit
        });
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        console.error("Failed to fetch projects", e);
        return [];
    }
  }

  async updateProject(projectId: string, name: string, clipsJson: string): Promise<any> {
    const res = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: this.getAuthHeader() as HeadersInit,
        body: JSON.stringify({ name, clipsJson })
    });
    if (!res.ok) throw new Error("Failed to update project");
    return await res.json();
  }

  async deleteProject(projectId: string): Promise<void> {
    await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader() as HeadersInit
    });
  }

  async getProjectById(projectId: string): Promise<any> {
    try {
        const res = await fetch(`${API_URL}/projects/${projectId}`, {
            headers: this.getAuthHeader() as HeadersInit
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error("Failed to fetch project", e);
        return null;
    }
  }
}

export const backend = new BackendService();
