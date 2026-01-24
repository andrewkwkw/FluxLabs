import React, { useState, useRef, useEffect } from 'react';
import { Settings2, ArrowRight, Sparkles, Image as ImageIcon, X, ChevronDown, Square, ArrowRightFromLine } from 'lucide-react';
import { GenerationType, VideoTask } from '../../types';

interface PromptInputProps {
  onGenerate: (type: GenerationType, prompt: string, model: string, ratio: string, imgBase64?: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  contextClip?: VideoTask | null;
  onClearContext?: () => void;
}

export const PromptInput: React.FC<PromptInputProps> = ({ 
    onGenerate, 
    onStop, 
    isGenerating,
    contextClip,
    onClearContext
}) => {
  const [mode, setMode] = useState<GenerationType>(GenerationType.TEXT_TO_VIDEO);
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Model state: default Flamingo
  const [model, setModel] = useState<'flamingo' | 'bangau'>('flamingo');
  const [ratio] = useState('16:9'); // Hardcoded for now as requested only model changes

  // Dropdown visibility states
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
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

  // Sync mode with contextClip
  useEffect(() => {
      if (contextClip) {
          setMode(GenerationType.IMAGE_TO_VIDEO); // Extension is technically img-to-video using last frame
      }
  }, [contextClip]);

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
    if (!prompt.trim() && !selectedImage && !contextClip) return;
    
    // If extending, we prioritize the contextClip's thumbnail as the source image
    const sourceImage = contextClip ? contextClip.thumbnailUrl : (selectedImage || undefined);
    
    onGenerate(mode, prompt, model, ratio, sourceImage);
    
    setPrompt('');
    setSelectedImage(null);
    if (onClearContext) onClearContext();
  };

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-3xl px-4 z-20">
      <div className={`bg-[#1f1f1f] rounded-2xl p-2 border shadow-2xl transition-all ${contextClip ? 'border-orange-500/50 shadow-orange-900/20' : 'border-white/10'}`}>
        
        {/* CONTEXT HEADER (Visible only when extending) */}
        {contextClip && (
            <div className="flex items-center justify-between px-3 py-2 bg-[#2a2a2a] rounded-t-lg mx-[-8px] mt-[-8px] mb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        <ArrowRightFromLine size={12} />
                        Perpanjang
                    </div>
                    <span className="text-xs text-gray-400 max-w-[200px] truncate">
                        dari scene: {contextClip.prompt || "Untitled"}
                    </span>
                </div>
                <button 
                    onClick={onClearContext}
                    className="text-gray-500 hover:text-white transition"
                >
                    <X size={14} />
                </button>
            </div>
        )}

        {/* Header / Mode Switcher */}
        {!contextClip && (
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
                    <div className="absolute top-full left-0 mt-2 bg-[#2a2a2a] rounded-lg border border-white/10 w-48 z-50 shadow-xl overflow-hidden">
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
                        <div className="absolute top-full right-0 mt-2 bg-[#2a2a2a] rounded-lg border border-white/10 w-32 z-50 shadow-xl overflow-hidden">
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

        {/* Image Preview (Standard Upload) */}
        {selectedImage && !contextClip && (
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

        {/* Input Area */}
        <div className="relative px-2 pb-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
                contextClip 
                ? "Setelah adegan dalam video ini terjadi, lalu..."
                : (mode === GenerationType.IMAGE_TO_VIDEO ? "Deskripsikan video yang diinginkan dari gambar..." : "Buat video dengan teks...")
            }
            className="w-full bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none resize-none h-12 pt-2 pr-24"
            autoFocus={!!contextClip}
          />

          {/* Action Bar */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            {!contextClip && (
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
                    onClick={onStop}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/20"
                >
                     <Square size={14} fill="currentColor" /> Stop
                </button>
            ) : (
                <button 
                    onClick={handleSubmit}
                    disabled={!prompt && !selectedImage && !contextClip}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
                        (!prompt && !selectedImage && !contextClip)
                            ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                            : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                >
                    <Sparkles size={14} />
                    {prompt || selectedImage || contextClip ? 'Generate' : 'Luaskan'}
                    <ArrowRight size={14} />
                </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-gray-600 mt-3">Flow dapat membuat kesalahan, jadi periksa kembali output-nya</p>
    </div>
  );
};