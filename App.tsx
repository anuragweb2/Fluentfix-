
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { correctText, speakText } from './services/geminiService.ts';
import { AppStatus, CorrectionResult, ToneType } from './types.ts';
import { Logo, CopyIcon, CheckIcon, EraserIcon, LightningIcon, MicIcon, MicOffIcon } from './components/Icons.tsx';

const TONES: ToneType[] = ['Standard', 'Professional', 'Academic', 'Friendly', 'Casual'];
const STORAGE_KEY = 'fluent_fix_v14_input';

const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 12 8-12 8V4z"/></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>;

export default function App() {
  const [inputText, setInputText] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [selectedTone, setSelectedTone] = useState<ToneType>('Standard');
  const [humanize, setHumanize] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, inputText);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(320, textareaRef.current.scrollHeight)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (e: any) => {
        const transcript = Array.from(e.results).slice(e.resultIndex).map((res: any) => res[0].transcript).join('');
        setInputText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + transcript);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
    return () => recognitionRef.current?.stop();
  }, []);

  const handleCorrect = useCallback(async () => {
    const val = inputText.trim();
    if (!val || status === AppStatus.LOADING) return;

    setStatus(AppStatus.LOADING);
    setCopied(false);
    if (isPlaying) stopAudio();

    try {
      const corrected = await correctText(val, selectedTone, humanize);
      setResult({
        id: Date.now().toString(),
        original: val,
        corrected: corrected,
        tone: selectedTone,
        timestamp: Date.now()
      });
      setStatus(AppStatus.SUCCESS);
    } catch (e) {
      setStatus(AppStatus.ERROR);
    }
  }, [inputText, selectedTone, status, humanize, isPlaying]);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleSpeak = async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }
    if (!result?.corrected) return;

    setIsPlaying(true);
    try {
      const audioData = await speakText(result.corrected, result.tone);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const dataInt16 = new Int16Array(audioData);
      const audioBuffer = audioContextRef.current.createBuffer(1, dataInt16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      sourceNodeRef.current = source;
      source.start();
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setResult(null);
    setStatus(AppStatus.IDLE);
    stopAudio();
    textareaRef.current?.focus();
  };

  const handleCopy = async () => {
    if (result?.corrected) {
      await navigator.clipboard.writeText(result.corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-20 z-50" />

      <nav className="border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-xl z-40 px-8 py-5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 group">
              <div className="bg-slate-900 text-white p-2 rounded-xl group-hover:bg-indigo-600 transition-colors duration-500">
                <Logo />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight leading-none uppercase">FLUENT<span className="text-indigo-600">FIX</span></span>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">AI Studio v14.0</span>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center gap-6 border-l border-slate-100 pl-8">
              <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black uppercase tracking-widest pl-3 opacity-40">Humanize</span>
                <button 
                  onClick={() => setHumanize(!humanize)} 
                  className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${humanize ? 'bg-indigo-600 shadow-md shadow-indigo-200' : 'bg-slate-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${humanize ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 overflow-x-auto no-scrollbar max-w-full">
            {TONES.map(t => (
              <button 
                key={t} 
                onClick={() => setSelectedTone(t)} 
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap ${selectedTone === t ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto w-full p-8 flex-1 grid lg:grid-cols-2 gap-12 my-6 items-stretch overflow-hidden">
        <section className="bg-white rounded-[3rem] flex flex-col transition-all duration-500 border border-slate-100 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.02)] focus-within:shadow-[0_24px_48px_-12px_rgba(79,70,229,0.08)] focus-within:border-indigo-100 overflow-hidden relative">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 text-white p-1.5 rounded-lg scale-75">
                <Logo />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Input Source</h3>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => { if(isListening) recognitionRef.current?.stop(); else recognitionRef.current?.start(); setIsListening(!isListening); }} 
                className={`p-3.5 rounded-2xl transition-all ${isListening ? 'bg-red-50 text-red-500 animate-pulse' : 'hover:bg-slate-50 text-slate-400'}`}
              >
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button onClick={handleClear} className="p-3.5 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all rounded-2xl">
                <EraserIcon />
              </button>
            </div>
          </div>
          
          <div className="flex-1 relative">
            <textarea 
              ref={textareaRef} 
              className="w-full h-full p-12 text-2xl font-semibold focus:outline-none resize-none bg-transparent placeholder:text-slate-200 no-scrollbar overflow-y-auto leading-relaxed" 
              placeholder="Start writing or paste your text here..." 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
            />
          </div>

          <div className="p-10 flex justify-between items-center bg-slate-50/30">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{inputText.length} characters</span>
            <button 
              onClick={handleCorrect} 
              disabled={status === AppStatus.LOADING || !inputText.trim()} 
              className={`px-14 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-4 group ${status === AppStatus.LOADING ? 'bg-slate-100 text-slate-300 cursor-wait' : 'bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-2xl hover:shadow-indigo-200 active:scale-[0.98]'}`}
            >
              {status === AppStatus.LOADING ? (
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              ) : (
                <div className="group-hover:rotate-12 transition-transform duration-300"><LightningIcon /></div>
              )}
              {status === AppStatus.LOADING ? 'Analyzing' : 'Enhance Writing'}
            </button>
          </div>
        </section>

        <section className={`rounded-[3rem] flex flex-col transition-all duration-700 overflow-hidden relative ${result ? 'bg-white border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)]' : 'bg-slate-50/50 border border-dashed border-slate-200'}`}>
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className={`w-1.5 h-6 rounded-full transition-colors duration-500 ${result ? 'bg-indigo-500' : 'bg-slate-200'}`} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Refined Output</h3>
            </div>
            {result && (
              <div className="flex gap-2">
                <button 
                  onClick={handleSpeak}
                  className={`p-3.5 rounded-2xl transition-all ${isPlaying ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-100 text-slate-400'}`}
                  title="Listen to correction"
                >
                  {isPlaying ? <StopIcon /> : <PlayIcon />}
                </button>
                <button 
                  onClick={handleCopy} 
                  className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${copied ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-xl shadow-indigo-50'}`}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-12 overflow-y-auto no-scrollbar relative group">
            {status === AppStatus.LOADING && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-md z-20">
                <div className="flex gap-2.5 mb-6">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-3.5 h-3.5 bg-indigo-600 rounded-full animate-bounce shadow-lg shadow-indigo-100" style={{animationDelay: `${i*0.1}s`}} />
                  ))}
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-900 animate-pulse">Processing Linguistics</span>
              </div>
            )}
            
            {result ? (
              <div className="text-2xl font-semibold leading-relaxed text-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {result.corrected.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-4' : ''}>{line}</p>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-[0.04] pointer-events-none select-none">
                <div className="scale-[2.5] mb-12"><Logo /></div>
                <p className="text-4xl font-black uppercase tracking-[0.8em]">Studio Idle</p>
                <p className="mt-4 text-sm font-bold tracking-[0.2em] uppercase">Awaiting content for refinement</p>
              </div>
            )}
            
            {!result && status === AppStatus.IDLE && (
              <div className="absolute inset-x-0 h-px bg-indigo-500/10 neural-line top-0 pointer-events-none" />
            )}
          </div>

          <div className="p-8 text-center border-t border-slate-50 bg-white">
             <div className="flex items-center justify-center gap-6">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">
                  {status === AppStatus.ERROR ? 'Service Disconnected' : (result ? 'Linguistic Accuracy: High' : 'Ready for analysis')}
                </span>
                {result && <div className="h-1 w-1 rounded-full bg-emerald-400" />}
             </div>
          </div>
        </section>
      </main>

      <footer className="py-24 border-t border-slate-100 text-center px-8 bg-white mt-12">
        <div className="max-w-[800px] mx-auto">
          <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-300 mb-8">Crafted for Excellence</h4>
          <div className="h-[2px] w-24 bg-indigo-500/20 mx-auto rounded-full mb-12" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <div className="space-y-3">
              <p className="text-slate-900">Infrastructure</p>
              <p className="opacity-40">Gemini 3 Pro Hybrid</p>
            </div>
            <div className="space-y-3">
              <p className="text-slate-900">Privacy</p>
              <p className="opacity-40">Stateless Session-Only</p>
            </div>
            <div className="space-y-3">
              <p className="text-slate-900">Audio</p>
              <p className="opacity-40">24kHz PCM Native TTS</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
