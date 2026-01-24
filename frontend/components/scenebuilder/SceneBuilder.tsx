import React, { useState, useRef, useEffect } from 'react';
import {
    ArrowLeft, Pencil, Save, Volume2, Monitor, HelpCircle, MoreVertical,
    Play, Pause, Settings2, Download, Plus, Trash2, Maximize, Menu, ArrowRightFromLine, CornerUpRight, Loader2, Image as ImageIcon, X, ChevronDown, Square, Sparkles, ArrowRight
} from 'lucide-react';
import { VideoTask, GenerationStatus, GenerationType } from '../../types';
import { backend } from '../../services/backendService';
import { generateThumbnail } from '../../services/thumbnailService'; // Assuming thumbnailService.ts is also present in frontend/services/

// Default duration estimation for clips that haven't loaded metadata yet
const DEFAULT_CLIP_DURATION = 4;

interface SceneBuilderProps {
    initialClips: VideoTask[];
    onBack: () => void;
    onGenerate: (type: GenerationType, prompt: string, model: string, ratio: string, imgBase64?: string) => void;
    isGenerating: boolean;
    onStopGeneration: () => void;
    onUpdateClips: (clips: VideoTask[]) => void;
    initialProjectName?: string;
    initialProjectId?: string | null;
}

export const SceneBuilder: React.FC<SceneBuilderProps> = ({
    initialClips,
    onBack,
    onGenerate,
    isGenerating,
    onStopGeneration,
    onUpdateClips,
    initialProjectName = "Untitled Project",
    initialProjectId = null
}) => {
    // --- STATE & LOGIC (from useSceneBuilderState) ---
    const [projectName, setProjectName] = useState(initialProjectName);
    const [isEditingName, setIsEditingName] = useState(false);
    const [clips, setClips] = useState<VideoTask[]>(initialClips);
    const [activeClipIndex, setActiveClipIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(initialProjectId);
    const [generatingThumbnails, setGeneratingThumbnails] = useState<{ [clipId: string]: boolean }>({});
    const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
    const [activeMenuClipId, setActiveMenuClipId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);
    const [extensionClip, setExtensionClip] = useState<VideoTask | null>(null);
    const [extensionMode, setExtensionMode] = useState<'jump' | 'extend' | null>(null);
    const [showPlayheadMenu, setShowPlayheadMenu] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [clipDurations, setClipDurations] = useState<{ [key: string]: number }>({});
    const [isDragging, setIsDragging] = useState(false);
    const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const [isExtending, setIsExtending] = useState<string | null>(null); // Corrected type and initial value

    const menuRef = useRef<HTMLDivElement>(null);
    const playheadMenuRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const dragTargetRef = useRef<{ index: number, rect: DOMRect } | null>(null);
    const trimDragRef = useRef<{ index: number, startX: number, initialTrimVal: number, duration: number, rect: DOMRect } | null>(null);
    const renderLoopRef = useRef<number | null>(null);

    useEffect(() => {
        setClips(initialClips);
        if (initialClips.length > clips.length) {
            setActiveClipIndex(initialClips.length - 1);
        }
    }, [initialClips]);

    useEffect(() => {
        clips.forEach((clip, index) => {
            if (
                clip.status === GenerationStatus.COMPLETED &&
                clip.resultUrl &&
                !clip.thumbnailUrl &&
                !generatingThumbnails[clip.id]
            ) {
                setGeneratingThumbnails(prev => ({ ...prev, [clip.id]: true }));
                generateThumbnail(clip.resultUrl)
                    .then(thumbnailDataUrl => {
                        setClips(prevClips => {
                            const newClips = [...prevClips];
                            if (newClips[index]) {
                                newClips[index] = { ...newClips[index], thumbnailUrl: thumbnailDataUrl };
                            }
                            return newClips;
                        });
                    })
                    .catch(error => console.error(`[Thumbnail] Failed for clip ${clip.id}:`, error))
                    .finally(() => setGeneratingThumbnails(prev => ({ ...prev, [clip.id]: false })));
            }
        });
    }, [clips, generatingThumbnails]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuClipId(null);
            }
            if (showPlayheadMenu && playheadMenuRef.current && !playheadMenuRef.current.contains(event.target as Node)) {
                if (!(event.target as HTMLElement).closest('[data-playhead-plus]')) {
                    setShowPlayheadMenu(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPlayheadMenu]);

    const activeClip = clips[activeClipIndex];

    const handleSave = async () => {
        try {
            // Serialize full state including trim data
            const clipsData = clips.map(c => ({
                id: c.id,
                trimStart: c.trimStart,
                trimEnd: c.trimEnd
            }));
            const clipsJson = JSON.stringify(clipsData);

            if (projectId) {
                await backend.updateProject(projectId, projectName, clipsJson);
            } else {
                const result = await backend.saveProject(projectName, clipsJson);
                setProjectId(result.id);
            }
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch (error) {
            console.error("Failed to save project:", error);
            alert("Failed to save project");
        }
    };

    useEffect(() => {
        if (!videoRef.current || !activeClip || isRendering) return;
        const start = activeClip.trimStart ?? 0;
        if (Math.abs(videoRef.current.currentTime - start) > 0.15) {
            videoRef.current.currentTime = start;
            setCurrentTime(start);
        }
        if (isPlaying && videoRef.current.paused) {
            videoRef.current.play().catch(err => {
                console.warn('Auto-play failed:', err.name);
                setIsPlaying(false);
            });
        }
    }, [activeClipIndex, activeClip, isPlaying, isRendering]);

    const togglePlay = () => {
        if (!videoRef.current || !activeClip || isRendering) return;
        const video = videoRef.current;
        const isPaused = video.paused;
        const start = activeClip.trimStart ?? 0;
        const end = activeClip.trimEnd ?? (clipDurations[activeClip.id] || DEFAULT_CLIP_DURATION);
        try {
            if (isPaused) {
                if (video.currentTime >= end - 0.05) {
                    video.currentTime = start;
                    setCurrentTime(start);
                }
                video.play().catch(err => setIsPlaying(false));
                setIsPlaying(true);
            } else {
                video.pause();
                setIsPlaying(false);
            }
        } catch (err) {
            console.error('togglePlay error:', err);
            setIsPlaying(false);
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current || !activeClip || isDragging || isTrimming || isRendering) return;
        const video = videoRef.current;
        const curr = video.currentTime;
        const start = activeClip.trimStart ?? 0;
        const end = activeClip.trimEnd ?? (clipDurations[activeClip.id] || DEFAULT_CLIP_DURATION);
        setCurrentTime(curr);
        if (isPlaying) {
            if (curr < start - 0.05) video.currentTime = start;
            else if (curr >= end - 0.05) handleVideoEnded();
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current && activeClip) {
            const duration = videoRef.current.duration;
            if (duration && !isNaN(duration) && duration !== Infinity) {
                setClipDurations(prev => ({ ...prev, [activeClip.id]: duration }));
                if (activeClip.trimEnd === undefined) {
                    const newClips = [...clips];
                    newClips[activeClipIndex] = { ...activeClip, trimEnd: duration };
                    setClips(newClips);
                    onUpdateClips(newClips);
                }
            }
        }
    };

    const handleVideoEnded = () => {
        if (!videoRef.current || !activeClip) return;
        if (activeClipIndex < clips.length - 1) {
            setActiveClipIndex(activeClipIndex + 1);
        } else {
            setIsPlaying(false);
            videoRef.current.pause();
            const resetPos = activeClip.trimStart ?? 0;
            videoRef.current.currentTime = resetPos;
            setCurrentTime(resetPos);
        }
    };

    const handleClipScrubberMouseDown = (e: React.MouseEvent, index: number) => {
        e.preventDefault(); e.stopPropagation();
        if (isRendering) return;
        setActiveClipIndex(index);
        setIsDragging(true);
        const rect = e.currentTarget.getBoundingClientRect();
        dragTargetRef.current = { index, rect };
        updateScrubber(e.clientX, rect, index);
    };

    const updateScrubber = (clientX: number, rect: DOMRect, index: number) => {
        const x = clientX - rect.left;
        const percent = Math.min(Math.max(0, x / rect.width), 1);
        const clip = clips[index];
        const duration = clipDurations[clip.id] || DEFAULT_CLIP_DURATION;
        const trimStart = clip.trimStart || 0;
        const trimEnd = clip.trimEnd !== undefined ? clip.trimEnd : duration;
        const visibleDuration = trimEnd - trimStart;

        // Fix: Scrubber maps to visible range in destructive mode
        const newTime = trimStart + (percent * visibleDuration);

        setCurrentTime(newTime);
        if (videoRef.current) videoRef.current.currentTime = newTime;
    };

    const handleTrimMouseDown = (e: React.MouseEvent, index: number, type: 'start' | 'end') => {
        e.preventDefault(); e.stopPropagation();
        if (isRendering) return;
        const clip = clips[index];
        const duration = clipDurations[clip.id] || DEFAULT_CLIP_DURATION;
        if (index !== activeClipIndex) setActiveClipIndex(index);
        setIsTrimming(type);

        const trimStart = clip.trimStart || 0;
        const trimEnd = clip.trimEnd !== undefined ? clip.trimEnd : duration;
        const visibleDuration = trimEnd - trimStart;

        const clipElement = (e.target as HTMLElement).closest('.group\\/item');
        const rect = clipElement?.getBoundingClientRect();
        if (rect) {
            console.log('[Trim Start]', { type, startX: e.clientX, rectWidth: rect.width, visibleDuration });
            // Store VISIBLE duration for delta calculation
            trimDragRef.current = {
                index,
                startX: e.clientX,
                initialTrimVal: type === 'start' ? trimStart : trimEnd,
                duration: visibleDuration, // Using visible duration for math
                rect
            };
        }
        if (isPlaying) { setIsPlaying(false); videoRef.current?.pause(); }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && dragTargetRef.current) {
                updateScrubber(e.clientX, dragTargetRef.current.rect, dragTargetRef.current.index);
            }
            if (isTrimming && trimDragRef.current) {
                const { index, initialTrimVal, duration: startVisibleDuration, rect } = trimDragRef.current;
                const clip = clips[index];
                const realDuration = clipDurations[clip.id] || DEFAULT_CLIP_DURATION;

                const deltaX = e.clientX - trimDragRef.current.startX;

                // Math: Ratio of change relative to the STARTING visible width/duration
                const deltaTime = (deltaX / rect.width) * startVisibleDuration;

                let newVal = initialTrimVal + deltaTime;

                if (isTrimming === 'start') {
                    const end = clip.trimEnd !== undefined ? clip.trimEnd : realDuration;
                    newVal = Math.max(0, Math.min(newVal, end - 0.5));
                } else {
                    const start = clip.trimStart || 0;
                    newVal = Math.max(start + 0.5, Math.min(newVal, realDuration));
                }

                if (Math.abs(newVal - (isTrimming === 'start' ? (clip.trimStart || 0) : (clip.trimEnd || realDuration))) > 0.05) {
                    const newClips = [...clips];
                    if (isTrimming === 'start') newClips[index] = { ...clip, trimStart: newVal };
                    else newClips[index] = { ...clip, trimEnd: newVal };

                    // Update current time to the trim point for feedback
                    setCurrentTime(newVal);
                    if (videoRef.current) videoRef.current.currentTime = newVal;

                    setClips(newClips);
                    onUpdateClips(newClips);
                }
            }
        };
        const handleMouseUp = () => {
            setIsDragging(false); dragTargetRef.current = null;
            setIsTrimming(null); trimDragRef.current = null;
        };
        if (isDragging || isTrimming) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isTrimming, clips, clipDurations]);

    const handleClipSelect = (index: number) => {
        if (index === activeClipIndex || isRendering) return;
        setActiveClipIndex(index);
        setIsPlaying(false);
        const clip = clips[index];
        const start = clip.trimStart || 0;
        if (videoRef.current) {
            videoRef.current.currentTime = start;
            setCurrentTime(start);
        }
    };

    const handleMenuActions = {
        open: (e: React.MouseEvent, clipId: string) => {
            e.stopPropagation();
            if (activeMenuClipId === clipId) {
                setActiveMenuClipId(null);
            } else {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPosition({ top: rect.top, left: rect.right });
                setActiveMenuClipId(clipId);
            }
        },
        jump: (index: number) => { setActiveClipIndex(index); setActiveMenuClipId(null); },
        extend: (clip: VideoTask) => {
            setExtensionClip(clip);
            setExtensionMode('extend');
            setIsExtending(clip.id);
            setActiveMenuClipId(null);
            setTimeout(() => document.querySelector('textarea')?.focus(), 100);
        },
        delete: (clipId: string) => {
            const updated = clips.filter(c => c.id !== clipId);
            setClips(updated);
            onUpdateClips(updated);
            setActiveMenuClipId(null);
            if (activeClipIndex >= updated.length) setActiveClipIndex(Math.max(0, updated.length - 1));
        }
    };

    // Constants for visual representation
    const BASE_WIDTH_PX = 224; // Equivalent to w-56 (14rem)

    // From useSceneBuilderState
    const handlePlayheadPlusClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowPlayheadMenu(!showPlayheadMenu);
    };

    // From useSceneBuilderState
    const handlePlayheadMenuAction = (mode: 'jump' | 'extend') => {
        if (mode === 'jump') {
            setExtensionMode('jump');
            setExtensionClip(null);
            setIsExtending(null); // Clear isExtending when jumping
        } else { // mode === 'extend'
            setExtensionMode('extend');
            setExtensionClip(activeClip || null);
            setIsExtending(activeClip ? activeClip.id : null); // Set isExtending to activeClip's ID when extending
        }
        setShowPlayheadMenu(false);
        setTimeout(() => document.querySelector('textarea')?.focus(), 100);
    };

    // From useSceneBuilderState
    const currentDuration = activeClip ? (clipDurations[activeClip.id] || DEFAULT_CLIP_DURATION) : 0;

    // From useSceneBuilderState
    const getSupportedMimeType = () => {
        const types = ["video/mp4;codecs=h264,aac", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
        const supported = types.find(type => MediaRecorder.isTypeSupported(type));
        return supported || "";
    };

    // From useSceneBuilderState
    const handleDownload = async () => {
        if (!activeClip || !activeClip.resultUrl || !videoRef.current || isRendering) return;

        const duration = clipDurations[activeClip.id] || DEFAULT_CLIP_DURATION;
        const start = activeClip.trimStart || 0;
        const end = activeClip.trimEnd !== undefined ? activeClip.trimEnd : duration;

        if (start <= 0.1 && end >= duration - 0.1) {
            const link = document.createElement('a');
            link.href = activeClip.resultUrl;
            link.download = `scene-${activeClip.id}.mp4`;
            link.click();
            return;
        }

        setIsRendering(true);
        setIsPlaying(false);
        const video = videoRef.current;
        const originalMuted = video.muted;
        const originalVolume = video.volume;

        try {
            video.pause();
            video.currentTime = start;
            video.muted = false;
            video.volume = 1.0;

            await new Promise<void>(r => {
                const h = () => { video.removeEventListener('seeked', h); r(); };
                video.addEventListener('seeked', h);
                if (Math.abs(video.currentTime - start) < 0.01) h();
            });

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            try {
                const videoTrack = (video as any).captureStream ? (video as any).captureStream(30).getVideoTracks()[0] : null;
                if (videoTrack) console.log("✓ Video track captured successfully");

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 1280;
                canvas.height = video.videoHeight || 720;

                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Cannot get canvas context");

                const canvasStream = (canvas as any).captureStream(30);

                if ((video as any).captureStream) {
                    const videoStreamTracks = (video as any).captureStream(30).getAudioTracks();
                    if (videoStreamTracks.length > 0) {
                        canvasStream.addTrack(videoStreamTracks[0]);
                    }
                }

                if (canvasStream.getAudioTracks().length === 0 && audioContext.state === 'running') {
                    console.warn("⚠ No audio captured, attempting fallback");
                    const audioDestination = audioContext.createMediaStreamDestination();
                    audioDestination.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
                }

                const mimeType = getSupportedMimeType();
                const options: MediaRecorderOptions = {
                    mimeType: mimeType || undefined,
                    videoBitsPerSecond: 50000000,
                    audioBitsPerSecond: 256000
                };

                const recorder = new MediaRecorder(canvasStream, options);
                const chunks: Blob[] = [];

                recorder.onerror = (event) => {
                    console.error("MediaRecorder error:", event.error);
                    setIsRendering(false);
                    alert("Recording error: " + event.error);
                };

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                recorder.onstop = () => {
                    try {
                        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
                        if (blob.size === 0) throw new Error("Recording produced empty blob");
                        const url = URL.createObjectURL(blob);

                        let extension = mimeType?.includes('mp4') ? 'mp4' : 'webm';

                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `trimmed-${activeClip.id}.${extension}`;
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 2000);

                    } catch (err) {
                        console.error("Download error:", err);
                        alert("Failed to create download: " + (err as any).message);
                    } finally {
                        setIsRendering(false);
                        if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);

                        video.currentTime = start;
                        video.muted = originalMuted;
                        video.volume = originalVolume;
                        video.pause();
                        canvasStream.getTracks().forEach(track => track.stop());
                        audioContext.close();
                    }
                };

                recorder.start();
                video.play();

                const frameLoop = () => {
                    try {
                        if (ctx && video.readyState >= video.HAVE_ENOUGH_DATA) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        }
                        if (video.currentTime >= end || video.ended) {
                            if (recorder.state !== 'inactive') recorder.stop();
                        } else if (recorder.state === 'recording') {
                            renderLoopRef.current = requestAnimationFrame(frameLoop);
                        }
                    } catch (err) {
                        console.error("Error in frame loop:", err);
                        setIsRendering(false);
                    }
                };
                renderLoopRef.current = requestAnimationFrame(frameLoop);
            } catch (err) {
                console.error("Audio context error:", err);
                audioContext.close();
                throw err;
            }
        } catch (err) {
            console.error("Trim rendering failed:", err);
            video.muted = originalMuted;
            video.volume = originalVolume;
            setIsRendering(false);
            alert("Trim failed: " + (err as any).message);
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sc = Math.floor(s % 60);
        return `${m}:${sc < 10 ? '0' : ''}${sc}`;
    };

    // PromptInput related state and logic (from SceneBuilderPromptInput.tsx)
    const [mode, setMode] = useState<GenerationType>(GenerationType.TEXT_TO_VIDEO);
    const [prompt, setPrompt] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [model, setModel] = useState<'flamingo' | 'bangau'>('flamingo');
    const [ratio] = useState('16:9');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => { // Close dropdowns when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowTypeDropdown(false);
            }
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => { // Sync mode with contextClip
        if (extensionClip) { // Using extensionClip as contextClip here
            setMode(GenerationType.IMAGE_TO_VIDEO);
        }
    }, [extensionClip]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
                setMode(GenerationType.IMAGE_TO_VIDEO);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleModeSelect = (newMode: GenerationType) => {
        setMode(newMode);
        setShowTypeDropdown(false);
    };

    const handleModelSelect = (newModel: 'flamingo' | 'bangau') => {
        setModel(newModel);
        setShowModelDropdown(false);
    };

    const handleSubmit = () => {
        if (!prompt.trim() && !selectedImage && !extensionClip) return;
        const sourceImage = extensionClip ? extensionClip.thumbnailUrl : (selectedImage || undefined);
        onGenerate(mode, prompt, model, ratio, sourceImage);
        setPrompt('');
        setSelectedImage(null);
        setExtensionClip(null); // Clear context after generation
        setExtensionMode(null); // Clear extension mode after generation
        setIsExtending(null); // Clear extending state after generation
    };


    return (
        <div className="flex flex-col h-[100dvh] bg-[#0a0a0a] text-white overflow-hidden">

            {/* ... (Header same) ... */}
            <header className="h-14 shrink-0 border-b border-white/10 flex items-center justify-between px-4 bg-[#0a0a0a] z-50">
                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition shrink-0">
                        <ArrowLeft size={18} /> <span className="hidden md:inline">Kembali</span>
                    </button>
                    <span className="text-gray-600 hidden md:inline">|</span>

                    <div className="flex items-center gap-2 group min-w-0">
                        {isEditingName ? (
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                onBlur={() => setIsEditingName(false)}
                                autoFocus
                                className="bg-transparent border-b border-white/20 focus:border-teal-500 outline-none text-sm font-medium w-32 md:w-40"
                            />
                        ) : (
                            <div className="flex items-center gap-2 cursor-pointer truncate" onClick={() => setIsEditingName(true)}>
                                <span className="text-sm font-medium truncate">{projectName}</span>
                                <Pencil size={12} className="text-gray-500 opacity-0 group-hover:opacity-100 transition shrink-0" />
                            </div>
                        )}
                    </div>

                    <span className={`hidden md:inline text-[10px] px-2 py-0.5 rounded text-black font-semibold shrink-0 ${projectId ? 'bg-green-500' : 'bg-yellow-600'}`}>
                        {projectId ? 'Saved' : 'Draft'}
                    </span>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-[#4a2b8a] hover:bg-[#5d36ad] text-white px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition"
                    >
                        <Save size={14} /> <span className="hidden md:inline">Simpan</span>
                    </button>

                    <div className="hidden md:flex items-center gap-1">
                        <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
                        <button className="p-2 hover:bg-white/10 rounded-full transition text-gray-400"><Volume2 size={18} /></button>
                        <button className="p-2 hover:bg-white/10 rounded-full transition text-gray-400"><Monitor size={18} /></button>
                        <button className="p-2 hover:bg-white/10 rounded-full transition text-gray-400"><HelpCircle size={18} /></button>
                    </div>

                    <button className="md:hidden p-2 text-gray-400"><Menu size={20} /></button>

                    <div className="hidden md:flex w-8 h-8 rounded-full bg-teal-600 items-center justify-center text-xs font-bold text-black ml-2">
                        D
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT AREA (Flex Grow) --- */}
            <div className="flex-1 min-h-0 flex flex-col relative">

                {/* Video Player (from VideoPlayer.tsx) */}
                <div className="flex-1 flex items-center justify-center bg-black relative min-h-0 overflow-hidden">
                    {activeClip ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <div className="relative aspect-video w-full max-h-full bg-[#000] shadow-2xl overflow-hidden group/video-container">
                                {/* RENDERING OVERLAY */}
                                {isRendering && (
                                    <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center pointer-events-auto cursor-wait">
                                        <Loader2 className="animate-spin text-teal-400 w-10 h-10 mb-3" />
                                        <div className="text-white font-medium">Processing Trim...</div>
                                        <div className="text-gray-400 text-xs mt-1">Please wait while we record the clip</div>
                                    </div>
                                )}

                                {activeClip.status === GenerationStatus.COMPLETED ? (
                                    <video
                                        key={activeClip.id}
                                        ref={videoRef}
                                        src={activeClip.resultUrl}
                                        className="w-full h-full object-contain"
                                        poster={activeClip.thumbnailUrl}
                                        onClick={togglePlay}
                                        onTimeUpdate={handleTimeUpdate}
                                        onLoadedMetadata={handleLoadedMetadata}
                                        onEnded={handleVideoEnded}
                                        playsInline
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
                                        <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full mb-2"></div>
                                        <span className="text-sm text-gray-400">Rendering Scene...</span>
                                    </div>
                                )}

                                <div className="absolute bottom-2 right-4 text-[10px] md:text-xs text-white/50 font-mono pointer-events-none uppercase tracking-wider">
                                    FLAMINGO
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500">
                            <Monitor size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium text-gray-400">Scene kosong</p>
                            <p className="text-sm text-gray-600 mt-1">Generate video baru di bawah untuk memulai</p>
                        </div>
                    )}
                </div>

                {/* --- BOTTOM SECTION: Timeline & Controls & Input --- */}
                <div className={`shrink-0 bg-[#0a0a0a] border-t border-white/10 flex flex-col z-30 transition-opacity ${isRendering ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>

                    {/* 1. Playback Controls Row (from PlaybackControls.tsx) */}
                    <div className="h-12 md:h-14 flex items-center justify-center px-4 md:px-6 border-b border-white/5 bg-[#0e0e0e] relative">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={togglePlay}
                                className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition active:scale-95 shadow-lg"
                            >
                                {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
                            </button>

                            <div className="text-xs md:text-sm font-mono text-gray-400 tracking-wide">
                                <span className="text-white">{formatTime(currentTime)}</span>
                                <span className="mx-1 text-gray-600">/</span>
                                {formatTime(currentDuration)}
                            </div>
                        </div>

                        <div className="absolute right-4 flex items-center gap-2 md:gap-4 text-gray-400">
                            <button
                                onClick={handleDownload}
                                className={`p-2 hover:bg-white/10 rounded-full transition ${!activeClip || activeClip.status !== GenerationStatus.COMPLETED ? 'opacity-30 cursor-not-allowed' : 'hover:text-white'}`}
                                disabled={!activeClip || activeClip.status !== GenerationStatus.COMPLETED || isRendering}
                                title="Download Clip"
                            >
                                {isRendering ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* 2. Storyboard / Clips Strip (from Timeline.tsx and Clip.tsx) */}
                    <div
                        className="flex items-center gap-3 overflow-hidden p-3 md:p-4 no-scrollbar bg-[#0a0a0a] min-h-[100px] items-start"
                        onScroll={() => setActiveMenuClipId(null)}
                    >

                        {/* Clips List */}
                        {clips.map((clip, idx) => {
                            const isClipActive = activeClipIndex === idx;
                            const clipDuration = clipDurations[clip.id] || DEFAULT_CLIP_DURATION;
                            const trimStart = clip.trimStart || 0;
                            const trimEnd = clip.trimEnd !== undefined ? clip.trimEnd : clipDuration;
                            const visibleDuration = trimEnd - trimStart;

                            // Destructive Mode Calculations
                            const FULL_WIDTH = 224; // Reference max width
                            const visibleRatio = visibleDuration / clipDuration;
                            const clipWidth = FULL_WIDTH * visibleRatio;
                            const shiftLeft = (trimStart / clipDuration) * FULL_WIDTH;

                            return (
                                <div
                                    key={clip.id}
                                    className="relative group/item flex-shrink-0"
                                    onMouseEnter={() => setHoveredClipId(clip.id)}
                                    onMouseLeave={() => setHoveredClipId(null)}
                                >
                                    <div
                                        className="relative h-16 md:h-24 cursor-pointer transition-all select-none group/container"
                                        style={{ width: `${Math.max(40, clipWidth)}px` }} // Min width to prevent collapse
                                        onMouseDown={(e) => handleClipScrubberMouseDown(e, idx)}
                                    >
                                        {/* Inner Image Container (Clipped & Bordered) */}
                                        <div className={`absolute inset-0 overflow-hidden rounded-lg border-2 ${isClipActive ? 'border-orange-500' : 'border-gray-800 group-hover/item:border-gray-600'}`}>
                                            <div
                                                className="absolute top-0 bottom-0 pointer-events-none"
                                                style={{ width: `${FULL_WIDTH}px`, transform: `translateX(-${shiftLeft}px)` }}
                                            >
                                                {clip.thumbnailUrl ? (
                                                    <img src={clip.thumbnailUrl} className="w-full h-full object-cover" loading="lazy" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                                        <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                                                    </div>
                                                )}
                                                {/* Dark overlay for inactive clips */}
                                                {!isClipActive && <div className="absolute inset-0 bg-black/30 group-hover/item:bg-transparent transition-colors"></div>}
                                            </div>
                                        </div>

                                        {/* --- HANDLES & PLAYHEAD (Overlay, Unclipped) --- */}
                                        {isClipActive && (
                                            <>
                                                {/* Left Handle */}
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-4 -ml-2 hover:ml-0 transition-all z-20 cursor-ew-resize flex items-center justify-start pl-1 group/handle"
                                                    onMouseDown={(e) => handleTrimMouseDown(e, idx, 'start')}
                                                >
                                                    <div className="h-full w-1.5 bg-white rounded-full shadow-lg group-hover/handle:bg-teal-400 transition-colors"></div>
                                                </div>

                                                {/* Right Handle */}
                                                <div
                                                    className="absolute right-0 top-0 bottom-0 w-4 -mr-2 hover:mr-0 transition-all z-20 cursor-ew-resize flex items-center justify-end pr-1 group/handle"
                                                    onMouseDown={(e) => handleTrimMouseDown(e, idx, 'end')}
                                                >
                                                    <div className="h-full w-1.5 bg-white rounded-full shadow-lg group-hover/handle:bg-teal-400 transition-colors"></div>
                                                </div>

                                                {/* Playhead */}
                                                <div
                                                    className="absolute top-[-24px] bottom-[-24px] z-30 pointer-events-none"
                                                    style={{ left: `${((currentTime - trimStart) / visibleDuration) * 100}%` }}
                                                >
                                                    {/* Vertical White Line */}
                                                    <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transform -translate-x-1/2 rounded-full"></div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* ... Menu Button ... */}
                                    {(hoveredClipId === clip.id || activeMenuClipId === clip.id) && (
                                        <button
                                            onClick={(e) => handleMenuActions.open(e, clip.id)}
                                            className="absolute -top-3 right-0 bg-white text-black p-1.5 rounded-full shadow-lg z-20 hover:bg-gray-200"
                                        >
                                            <MoreVertical size={14} />
                                        </button>
                                    )}
                                    {/* --- CONTEXT MENU MOVED TO ROOT --- */}
                                </div>
                            );
                        })}


                    </div>
                </div>

                {/* --- PROMPT INPUT (from SceneBuilderPromptInput.tsx) --- */}
                < div className="shrink-0 w-full bg-[#050505] p-2 md:p-4 border-t border-white/5" >
                    <div className="max-w-4xl mx-auto relative h-28 md:h-32">
                        {/* Position relative to contain the PromptInput properly */}
                        <div className="absolute inset-0 top-2 md:top-4">
                            {/* CONTEXT HEADER (Visible only when extending or jumping) */}
                            {(extensionClip || extensionMode === 'jump') && (
                                <div className="flex items-center justify-between px-3 py-2 bg-[#2a2a2a] rounded-t-lg mx-[-8px] mt-[-8px] mb-2 border-b border-white/5">
                                    <div className="flex items-center gap-2">
                                        {extensionMode === 'extend' && extensionClip ? (
                                            <div className="flex items-center gap-1.5 bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                                <ArrowRightFromLine size={12} />
                                                Perpanjang
                                            </div>
                                        ) : extensionMode === 'jump' ? (
                                            <div className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                                <ImageIcon size={12} />
                                                Lompat ke
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                                <ArrowRightFromLine size={12} />
                                                Perpanjang
                                            </div>
                                        )}
                                        {extensionClip && (
                                            <span className="text-xs text-gray-400 max-w-[200px] truncate">
                                                dari scene: {extensionClip.prompt || "Untitled"}
                                            </span>
                                        )}
                                        {extensionMode === 'jump' && !selectedImage && ( // Changed contextClip to selectedImage for this condition
                                            <span className="text-xs text-gray-400">
                                                Silakan upload gambar untuk memulai scene baru
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setExtensionClip(null); // Clear context
                                            setExtensionMode(null); // Clear extension mode
                                            setIsExtending(null); // Clear extending state
                                        }}
                                        className="text-gray-500 hover:text-white transition"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Header / Mode Switcher */}
                            {!extensionClip && !extensionMode && (
                                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-1 relative">

                                    {/* TYPE SELECTOR */}
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                                            className="flex items-center gap-2 font-semibold text-sm text-white hover:text-gray-300 transition"
                                        >
                                            {mode === GenerationType.TEXT_TO_VIDEO ? 'Teks ke Video' : 'Gambar ke Video'}
                                            <ChevronDown size={14} className={`transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showTypeDropdown && (
                                            <div className="absolute bottom-full left-0 mb-2 bg-[#2a2a2a] rounded-lg border border-white/10 w-48 z-50 shadow-xl overflow-hidden">
                                                <div
                                                    onClick={() => handleModeSelect(GenerationType.TEXT_TO_VIDEO)}
                                                    className={`p-3 text-sm hover:bg-white/5 cursor-pointer flex items-center justify-between ${mode === GenerationType.TEXT_TO_VIDEO ? 'text-teal-400' : 'text-gray-300'}`}
                                                >
                                                    Teks ke Video
                                                    {mode === GenerationType.TEXT_TO_VIDEO && <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>}
                                                </div>
                                                <div
                                                    onClick={() => handleModeSelect(GenerationType.IMAGE_TO_VIDEO)}
                                                    className={`p-3 text-sm hover:bg-white/5 cursor-pointer flex items-center justify-between ${mode === GenerationType.IMAGE_TO_VIDEO ? 'text-teal-400' : 'text-gray-300'}`}
                                                >
                                                    Gambar ke Video
                                                    {mode === GenerationType.IMAGE_TO_VIDEO && <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* RIGHT SIDE SETTINGS */}
                                    <div className="flex items-center gap-3 text-xs text-gray-400">

                                        {/* MODEL SELECTOR */}
                                        <div className="relative" ref={modelDropdownRef}>
                                            <button
                                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                                className="flex items-center gap-1 hover:text-white transition"
                                            >
                                                <span className="capitalize">{model}</span>
                                                <span className="text-gray-500">- Fast</span>
                                                <ChevronDown size={12} className={`ml-1 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                            </button>

                                            {showModelDropdown && (
                                                <div className="absolute bottom-full right-0 mb-2 bg-[#2a2a2a] rounded-lg border border-white/10 w-32 z-50 shadow-xl overflow-hidden">
                                                    <div
                                                        onClick={() => handleModelSelect('flamingo')}
                                                        className={`p-2.5 text-sm hover:bg-white/5 cursor-pointer ${model === 'flamingo' ? 'text-teal-400' : 'text-gray-300'}`}
                                                    >
                                                        Flamingo
                                                    </div>
                                                    <div
                                                        onClick={() => handleModelSelect('bangau')}
                                                        className={`p-2.5 text-sm hover:bg-white/5 cursor-pointer ${model === 'bangau' ? 'text-teal-400' : 'text-gray-300'}`}
                                                    >
                                                        Bangau
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="h-4 w-[1px] bg-white/10"></div>

                                        <span className="flex items-center gap-1 cursor-not-allowed opacity-70">
                                            <span className="w-3 h-2 border border-gray-400 rounded-sm block"></span> 16:9
                                        </span>

                                        <span className="cursor-not-allowed opacity-70">x1</span>

                                        <Settings2 size={14} className="hover:text-white cursor-pointer" />
                                    </div>
                                </div>
                            )}

                            {/* Image Preview (Standard Upload or Jump Mode) */}
                            {selectedImage && !extensionClip && !extensionMode && (
                                <div className="relative inline-block m-2">
                                    <img src={selectedImage} alt="Preview" className="h-16 rounded border border-white/10" />
                                    <button
                                        onClick={() => { setSelectedImage(null); setMode(GenerationType.TEXT_TO_VIDEO); }}
                                        className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white shadow-sm hover:bg-red-600 transition"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            )}

                            {/* Image Upload Message (Jump Mode) */}
                            {extensionMode === 'jump' && !selectedImage && (
                                <div className="text-center py-3 text-sm text-gray-400">
                                    <p>Silakan upload gambar untuk memulai scene baru</p>
                                </div>
                            )}

                            {/* Display contextClip thumbnail if extending */}
                            {extensionClip && extensionClip.thumbnailUrl && extensionMode === 'extend' && (
                                <div className="relative inline-block m-2">
                                    <img src={extensionClip.thumbnailUrl} alt="Last frame" className="h-16 rounded border border-orange-500/50" />
                                    <button
                                        onClick={() => {
                                            setExtensionClip(null); // Clear context
                                            setExtensionMode(null); // Clear extension mode
                                            setIsExtending(null); // Clear extending state
                                        }}
                                        className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white shadow-sm hover:bg-red-600 transition"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            )}

                            {/* Input Area */}
                            <div className="relative px-2 pb-2">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={
                                        extensionClip
                                            ? "Setelah adegan dalam video ini terjadi, lalu..."
                                            : (mode === GenerationType.IMAGE_TO_VIDEO ? "Deskripsikan video yang diinginkan dari gambar..." : "Buat video dengan teks...")
                                    }
                                    className="w-full bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none resize-y min-h-[3rem] pt-2 pr-24"
                                    autoFocus={!!extensionClip}
                                />

                                {/* Action Bar */}
                                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                                    {!extensionClip && (
                                        <>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                            />

                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`p-2 rounded-full transition ${mode === GenerationType.IMAGE_TO_VIDEO ? 'text-teal-400 bg-teal-400/10 hover:bg-teal-400/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                title="Upload Image"
                                            >
                                                <ImageIcon size={18} />
                                            </button>
                                        </>
                                    )}

                                    {isGenerating ? (
                                        <button
                                            onClick={onStopGeneration}
                                            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/20"
                                        >
                                            <Square size={14} fill="currentColor" /> Stop
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleSubmit}
                                            disabled={!prompt && !selectedImage && !extensionClip}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${(!prompt && !selectedImage && !extensionClip)
                                                ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                                : 'bg-white/10 hover:bg-white/20 text-white'
                                                }`}
                                        >
                                            <Sparkles size={14} />
                                            {prompt || selectedImage || extensionClip ? 'Generate' : 'Luaskan'}
                                            <ArrowRight size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-[10px] text-gray-600">Flow dapat membuat kesalahan, jadi periksa kembali output-nya</p>
                    </div>

                </div >
            </div >

            {/* --- FLOATING CONTEXT MENU (FIXED POSITION) --- */}
            {activeMenuClipId && menuPosition && (() => {
                const clipIndex = clips.findIndex(c => c.id === activeMenuClipId);
                const clip = clips[clipIndex];
                if (!clip) return null;

                return (
                    <div
                        ref={menuRef}
                        className="fixed w-48 bg-[#1a1a1a] rounded-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[100] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                        style={{
                            top: menuPosition.top - 10,
                            left: menuPosition.left + 5,
                            transform: 'translate(-100%, -100%)'
                        }}
                    >
                        <div className="p-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleMenuActions.jump(clipIndex); }}
                                className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 rounded-lg flex items-center gap-3 transition"
                            >
                                <CornerUpRight size={16} className="text-gray-400" />
                                Lompat ke...
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleMenuActions.extend(clip); }}
                                className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 rounded-lg flex items-center gap-3 transition"
                            >
                                <ArrowRightFromLine size={16} className="text-gray-400" />
                                Perpanjang...
                            </button>
                            <div className="h-[1px] bg-white/5 my-1"></div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleMenuActions.delete(clip.id); }}
                                className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-3 transition"
                            >
                                <Trash2 size={16} />
                                Hapus
                            </button>
                        </div>
                        {/* Triangle pointer */}
                        <div className="absolute bottom-[-6px] right-5 w-3 h-3 bg-[#1a1a1a] border-r border-b border-white/10 transform rotate-45"></div>
                    </div>
                );
            })()}

            {/* --- FLOATING PLAYHEAD MENU --- */}
            {showPlayheadMenu && playheadMenuRef && (
                <div
                    className="fixed bottom-56 left-1/2 -translate-x-1/2 w-48 bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl p-1 z-[60] animate-in slide-in-from-bottom-2 fade-in duration-200"
                    ref={playheadMenuRef}
                >
                    <button onClick={() => { setShowPlayheadMenu(false); fileInputRef.current?.click(); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 rounded-lg flex items-center gap-2 mb-1">
                        <ImageIcon size={14} className="text-gray-500" /> Mulai dengan Gambar
                    </button>
                    <button onClick={() => handlePlayheadMenuAction('extend')} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 rounded-lg flex items-center gap-2">
                        <ArrowRightFromLine size={14} className="text-gray-500" /> Perpanjang Scene
                    </button>
                    {/* Arrow down */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a1a] border-r border-b border-white/10 rotate-45"></div>
                </div>
            )}
        </div >
    );
};