import React, { useState, useRef, useEffect } from 'react';
import { Video, Heart, MoreVertical, Download, Plus, Trash2, Maximize2, Pencil, Play, Pause, AlertCircle } from 'lucide-react';
import { VideoTask, GenerationStatus } from '../../types';

interface VideoGridProps {
  tasks: VideoTask[];
  onDelete: (taskId: string) => void;
  onAddToScene?: (task: VideoTask) => void;
}

// Custom Video Player Component
const CustomVideoPlayer = ({ url, poster }: { url: string, poster?: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [hasError, setHasError] = useState(false);

    const togglePlay = () => {
        if (!videoRef.current || hasError) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const curr = videoRef.current.currentTime;
        const dur = videoRef.current.duration;
        if (dur) setProgress((curr / dur) * 100);
        if (dur && !duration) setDuration(dur);
    };
    
    const handleLoadedMetadata = () => {
         if (videoRef.current) setDuration(videoRef.current.duration);
    }

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!videoRef.current || hasError) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percent = Math.min(Math.max(0, x / width), 1);
        videoRef.current.currentTime = percent * videoRef.current.duration;
        setProgress(percent * 100);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (hasError) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] text-gray-500">
                <AlertCircle size={24} className="mb-2 opacity-50" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Video Failed</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative group/player bg-black">
            <video 
                ref={videoRef}
                src={url}
                className="w-full h-full object-cover cursor-pointer"
                poster={poster}
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onError={(e) => {
                    console.error("Video loading error:", e);
                    setHasError(true);
                }}
                playsInline
            />
            
            {/* Custom Controls */}
            {!hasError && (
                <div className={`absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-3 transition-opacity duration-200 z-10 ${isPlaying ? 'opacity-0 group-hover/player:opacity-100' : 'opacity-100'}`}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        className="text-white hover:text-gray-300 focus:outline-none"
                    >
                        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>

                    {/* Progress Bar Container */}
                    <div 
                        className="flex-1 h-1 bg-gray-600 rounded-full relative cursor-pointer group/seek"
                        onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
                    >
                        {/* Active Track */}
                        <div 
                            className="absolute top-0 left-0 h-full bg-[#FF8C00] rounded-full pointer-events-none"
                            style={{ width: `${progress}%` }}
                        ></div>
                        
                        {/* Thumb / Dot */}
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#FF8C00] rounded-full shadow-md pointer-events-none transition-transform group-hover/seek:scale-125"
                            style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                        ></div>
                    </div>

                    {/* Duration */}
                    <span className="text-[10px] text-white font-mono font-medium min-w-[24px] text-right">
                        {formatTime(duration || 0)}
                    </span>
                </div>
            )}
        </div>
    );
};

export const VideoGrid: React.FC<VideoGridProps> = ({ tasks, onDelete, onAddToScene }) => {
  
  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 pb-32">
        <div className="h-20 w-20 rounded-2xl bg-[#141414] border border-white/5 flex items-center justify-center mb-4">
            <Video size={32} className="opacity-50" />
        </div>
        <h3 className="text-gray-400 font-medium mb-1">Belum ada hasil generate</h3>
        <p className="text-xs text-gray-600">Mulai buat video dengan prompt di bawah</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-40">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tasks.map((task) => (
          <div key={task.id} className="group relative bg-[#141414] rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300">
            {/* Thumbnail / Video */}
            <div className="aspect-video bg-black relative flex items-center justify-center">
              
              {/* TOP OVERLAYS (Visible on Hover) */}
              <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
                  
                  {/* Left: Add to Scene Button */}
                  <button 
                    className="pointer-events-auto bg-[#f5e6d3] hover:bg-[#fff5e6] text-black text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg transform active:scale-95 transition"
                    onClick={() => onAddToScene && onAddToScene(task)}
                  >
                     <Plus size={12} strokeWidth={3} />
                     Tambahkan ke adegan
                  </button>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-2 pointer-events-auto">
                    {/* Edit */}
                    <button className="h-8 w-8 rounded-full bg-[#f5e6d3] hover:bg-[#fff5e6] text-black flex items-center justify-center shadow-lg transition active:scale-95">
                        <Pencil size={14} />
                    </button>
                    {/* Like */}
                    <button className="h-8 w-8 rounded-full bg-[#f5e6d3] hover:bg-[#fff5e6] text-black flex items-center justify-center shadow-lg transition active:scale-95">
                        <Heart size={14} />
                    </button>
                    {/* Download (Only if completed) */}
                    {task.status === GenerationStatus.COMPLETED && (
                        <a 
                            href={task.resultUrl} 
                            download={`fluxlabs-${task.id}.mp4`}
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 w-8 rounded-full bg-[#f5e6d3] hover:bg-[#fff5e6] text-black flex items-center justify-center shadow-lg transition active:scale-95"
                        >
                            <Download size={14} />
                        </a>
                    )}
                    {/* Expand */}
                    <button className="h-8 w-8 rounded-full bg-[#f5e6d3] hover:bg-[#fff5e6] text-black flex items-center justify-center shadow-lg transition active:scale-95">
                        <Maximize2 size={14} />
                    </button>
                    {/* Delete */}
                    <button 
                        onClick={() => onDelete(task.id)}
                        className="h-8 w-8 rounded-full bg-[#f5e6d3] hover:bg-red-200 text-black hover:text-red-600 flex items-center justify-center shadow-lg transition active:scale-95"
                    >
                        <Trash2 size={14} />
                    </button>
                  </div>
              </div>

              {/* Video Content */}
              {task.status === GenerationStatus.COMPLETED ? (
                <CustomVideoPlayer 
                    url={task.resultUrl || ""} 
                    poster={task.thumbnailUrl}
                />
              ) : task.status === GenerationStatus.FAILED ? (
                 <div className="text-red-500 text-xs flex flex-col items-center gap-2">
                    <span>⚠️ Failed</span>
                 </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                   <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full"></div>
                   <span className="text-xs text-teal-500">Generating...</span>
                   <span className="text-xs text-teal-500">Refresh halaman jika sudah 2 menit</span>
                </div>
              )}
            </div>

            {/* Bottom Info Area */}
            <div className="p-3 bg-[#141414] relative z-20">
                <div className="flex justify-between items-start">
                    <p className="text-xs text-gray-200 line-clamp-2 pr-4 font-light">{task.prompt || "Image to Video"}</p>
                    <div className="flex gap-2">
                        <button className="text-gray-500 hover:text-white text-[10px] whitespace-nowrap">Perpanjang</button>
                        <button className="text-gray-500 hover:text-white"><MoreVertical size={14} /></button>
                    </div>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
