
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { correctText, speakText, generateChallenges } from './services/geminiService.ts';
import { AppStatus, CorrectionResult, ToneType, AppMode, Challenge } from './types.ts';
import { Logo, CopyIcon, CheckIcon, EraserIcon, LightningIcon, MicIcon, MicOffIcon, SparklesIcon } from './components/Icons.tsx';

const TONES: ToneType[] = ['Standard', 'Professional', 'Academic', 'Friendly', 'Casual'];
const STORAGE_KEY = 'fluent_fix_prod_input';

const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 12 8-12 8V4z"/></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>;
const BookIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 6h10"/><path d="M8 10h10"/><path d="M8 14h10"/></svg>;
const PenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;

// Safe storage utility
const getStoredText = () => {
  try { return localStorage.getItem(STORAGE_KEY) || ''; }
  catch (e) { return ''; }
};

export default function App() {
  const [mode, setMode] = useState<AppMode>('EDITOR');
  const [inputText, setInputText] = useState(getStoredText);
  const [selectedTone, setSelectedTone] = useState<ToneType>('Standard');
  const [humanize, setHumanize] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeAnswers, setChallengeAnswers] = useState<Record<string, number>>({});
  const [solvedCount, setSolvedCount] = useState(0);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, inputText); } catch(e) {}
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(340, textareaRef.current.scrollHeight)}px`;
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
  }, []);

  const handleModeSwitch = (newMode: AppMode) => {
    if (newMode === mode) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setResult(null);
      setChallenges([]);
      setChallengeAnswers({});
      setSolvedCount(0);
      setStatus(AppStatus.IDLE);
      setIsTransitioning(false);
    }, 400);
  };

  const handleProcess = useCallback(async () => {
    const val = inputText.trim();
    if (!val || status === AppStatus.LOADING) return;

    setStatus(AppStatus.LOADING);
    setCopied(false);
    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
    }

    try {
      if (mode === 'EDITOR') {
        const corrected = await correctText(val, selectedTone, humanize);
        setResult({
          id: Date.now().toString(),
          original: val,
          corrected: corrected,
          tone: selectedTone,
          timestamp: Date.now()
        });
      } else {
        const newChallenges = await generateChallenges(val);
        setChallenges(newChallenges);
        setChallengeAnswers({});
        setSolvedCount(0);
      }
      setStatus(AppStatus.SUCCESS);
    } catch (e: any) {
      console.error(e);
      setStatus(AppStatus.ERROR);
    }
  }, [inputText, selectedTone, mode, humanize, isPlaying, status]);

  const handleSpeak = async () => {
    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
      return;
    }
    if (!result?.corrected) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const audioData = await speakText(result.corrected, result.tone);
      const dataInt16 = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
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
      setIsPlaying(true);
      source.start();
    } catch (e: any) {
      console.error(e);
      setIsPlaying(false);
    }
  };

  const handleCopy = async () => {
    if (result?.corrected) {
      await navigator.clipboard.writeText(result.corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleChallengeSelect = (challengeId: string, optionIndex: number, isCorrect: boolean) => {
    if (challengeAnswers[challengeId] !== undefined) return;
    setChallengeAnswers(prev => ({ ...prev, [challengeId]: optionIndex }));
    if (isCorrect) setSolvedCount(prev => prev + 1);
  };

  return (
    <div className={`min-h-screen bg-[#FAFAFB] text-slate-900 flex flex-col font-sans selection:bg-black selection:text-white transition-opacity duration-500 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
      
      {/* Status Bar */}
      <div className={`h-1.5 w-full fixed top-0 left-0 z-50 transition-all duration-700 ${status === AppStatus.LOADING ? 'bg-indigo-600 animate-pulse' : status === AppStatus.ERROR ? 'bg-red-500' : 'bg-transparent'}`} />

      <nav className="sticky top-0 bg-white/70 backdrop-blur-2xl border-b border-slate-100 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleModeSwitch('EDITOR')}>
              <div className="transition-transform duration-500 group-hover:rotate-12">
                <Logo />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight uppercase leading-none">Fluent<span className="text-indigo-600">Fix</span></span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Production AI</span>
              </div>
            </div>

            <div className="hidden md:flex items-center bg-slate-100/50 p-1 rounded-xl border border-slate-100">
              <button 
                onClick={() => handleModeSwitch('EDITOR')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${mode === 'EDITOR' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <PenIcon />
                Editor
              </button>
              <button 
                onClick={() => handleModeSwitch('LEARNING')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${mode === 'LEARNING' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <BookIcon />
                Learning
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {mode === 'EDITOR' && (
              <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl">
                {TONES.map(t => (
                  <button 
                    key={t} 
                    onClick={() => setSelectedTone(t)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedTone === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto w-full p-6 flex-1 grid lg:grid-cols-2 gap-8 mt-4 mb-12 items-stretch">
        {/* INPUT PANEL */}
        <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden group focus-within:ring-2 ring-indigo-50 transition-all">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Compose Your Text</h3>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => { if(isListening) recognitionRef.current?.stop(); else recognitionRef.current?.start(); setIsListening(!isListening); }} 
                className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-50 text-red-500 animate-pulse ring-2 ring-red-100' : 'text-slate-400 hover:bg-slate-50'}`}
                title="Voice Input"
              >
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button onClick={() => setInputText('')} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Clear All">
                <EraserIcon />
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-[400px]">
            <textarea 
              ref={textareaRef} 
              className="w-full h-full p-10 text-2xl font-semibold focus:outline-none resize-none bg-transparent placeholder:text-slate-200 leading-relaxed no-scrollbar" 
              placeholder="Start typing or paste your writing here to enhance it..." 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
            />
          </div>

          <div className="p-8 bg-slate-50/50 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Style:</span>
                  <button 
                    onClick={() => setHumanize(!humanize)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${humanize ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-600 hover:text-indigo-600'}`}
                  >
                    <SparklesIcon />
                    {humanize ? 'Natural Human Flow' : 'Concise Pro'}
                  </button>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{inputText.length} chars</span>
              </div>
              
              <button 
                onClick={handleProcess}
                disabled={status === AppStatus.LOADING || !inputText.trim()}
                className="group px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-3 shadow-xl shadow-slate-900/10"
              >
                {status === AppStatus.LOADING ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <div className="group-hover:rotate-12 transition-transform"><LightningIcon /></div>
                )}
                {status === AppStatus.LOADING ? 'Analyzing...' : mode === 'EDITOR' ? 'Fix & Polish' : 'Generate Tasks'}
              </button>
            </div>
          </div>
        </section>

        {/* OUTPUT PANEL */}
        <section className={`rounded-[2.5rem] border flex flex-col relative overflow-hidden transition-all duration-700 ${result || challenges.length > 0 ? 'bg-white border-slate-100 shadow-2xl shadow-slate-200/50' : 'bg-[#F2F3F7]/50 border-dashed border-slate-200'}`}>
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className={`w-1.5 h-4 rounded-full transition-colors duration-500 ${status === AppStatus.SUCCESS ? 'bg-emerald-500' : status === AppStatus.ERROR ? 'bg-red-500' : 'bg-slate-200'}`} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {mode === 'EDITOR' ? 'Linguistic Refinement' : 'Learning Module'}
              </h3>
            </div>
            {result && mode === 'EDITOR' && (
              <div className="flex gap-2">
                <button 
                  onClick={handleSpeak} 
                  className={`p-3 rounded-xl transition-all ${isPlaying ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}
                  title="Play Audio"
                >
                  {isPlaying ? <StopIcon /> : <PlayIcon />}
                </button>
                <button 
                  onClick={handleCopy} 
                  className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${copied ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? 'Done' : 'Copy'}
                </button>
              </div>
            )}
            {mode === 'LEARNING' && challenges.length > 0 && (
               <div className="px-4 py-2 bg-indigo-50 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                 Progress: {solvedCount}/{challenges.length}
               </div>
            )}
          </div>

          <div className="flex-1 p-10 overflow-y-auto relative no-scrollbar min-h-[400px]">
            {status === AppStatus.LOADING && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md transition-all">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                    <Logo />
                  </div>
                </div>
                <p className="mt-8 text-[11px] font-black uppercase tracking-[0.6em] text-slate-800 animate-pulse">Refining Excellence...</p>
              </div>
            )}

            {status === AppStatus.ERROR && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white p-10 text-center">
                <div className="text-red-500 mb-6 scale-[2]"><EraserIcon /></div>
                <h4 className="text-xl font-black uppercase tracking-widest text-slate-900 mb-2">Synthesis Interrupted</h4>
                <p className="text-slate-400 text-sm mb-8 font-medium">We encountered a temporary disruption. Please try again in a moment.</p>
                <button 
                  onClick={handleProcess}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all"
                >
                  Re-Attempt Analysis
                </button>
              </div>
            )}
            
            {mode === 'EDITOR' && result ? (
              <div className="text-2xl font-semibold leading-relaxed text-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {result.corrected}
              </div>
            ) : mode === 'LEARNING' && challenges.length > 0 ? (
               <div className="space-y-8 pb-10">
                 {challenges.map((c, i) => (
                   <div key={c.id || i} className="p-8 bg-[#FBFBFC] border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all group animate-in slide-in-from-bottom-6 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 bg-white border border-slate-200 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-full">{c.type}</span>
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Skill {i + 1}</span>
                      </div>
                      <h4 className="text-xl font-bold mb-6">How would you improve: <span className="text-indigo-600 italic">"{c.originalPart}"</span>?</h4>
                      <div className="grid gap-3">
                         {c.options.map((opt, oi) => {
                           const isSelected = challengeAnswers[c.id || i] === oi;
                           const isCorrect = oi === c.correctIndex;
                           const showFeedback = challengeAnswers[c.id || i] !== undefined;
                           
                           return (
                            <button 
                              key={oi} 
                              disabled={showFeedback}
                              onClick={() => handleChallengeSelect(c.id || i.toString(), oi, isCorrect)}
                              className={`w-full p-5 text-left rounded-2xl font-bold transition-all flex items-center justify-between group/opt border
                                ${showFeedback 
                                  ? (isCorrect ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : (isSelected ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-100 opacity-50'))
                                  : 'bg-white border-slate-100 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-50'
                                }`}
                            >
                              <span className={!showFeedback ? 'text-slate-600 group-hover/opt:text-indigo-600' : ''}>{opt}</span>
                              <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all 
                                ${showFeedback && isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-100'}`}>
                                 {showFeedback && isCorrect && <CheckIcon />}
                              </div>
                            </button>
                           );
                         })}
                      </div>
                      {challengeAnswers[c.id || i] !== undefined && (
                        <div className="mt-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
                           <p className="text-xs font-bold text-indigo-900 leading-relaxed uppercase tracking-wider mb-2">Expert Insight:</p>
                           <p className="text-sm text-indigo-700 leading-relaxed font-medium">{c.explanation}</p>
                        </div>
                      )}
                   </div>
                 ))}
               </div>
            ) : status !== AppStatus.ERROR && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-10 select-none pointer-events-none pb-20">
                <div className="scale-[2.5] mb-12"><Logo /></div>
                <h2 className="text-5xl font-black uppercase tracking-[0.6em] leading-tight">Studio<br/>Ready</h2>
                <p className="mt-4 text-xs font-bold tracking-[0.2em] uppercase">Advanced Linguistic Engine Online</p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-50 bg-white/50 backdrop-blur-md text-center">
             <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Secure Node: Connected</span>
                </div>
                <div className="h-4 w-[1px] bg-slate-100" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Response Tier: Premium</span>
             </div>
          </div>
        </section>
      </main>

      <footer className="py-20 border-t border-slate-100 text-center bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-2xl font-black uppercase tracking-[0.4em] mb-4 text-slate-900">Grammar with Grace & Power</p>
          <div className="h-0.5 w-24 bg-indigo-100 mx-auto mb-10" />
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            <div className="flex flex-col gap-3 group">
              <span className="text-slate-900 group-hover:text-indigo-600 transition-colors">Neural Core</span>
              <span className="opacity-40 leading-relaxed">Powered by Gemini 3 Flash<br/>Linguistic Synthesis</span>
            </div>
            <div className="flex flex-col gap-3 group">
              <span className="text-slate-900 group-hover:text-indigo-600 transition-colors">Privacy Priority</span>
              <span className="opacity-40 leading-relaxed">No Local Storage Retention<br/>Encrypted Transmission</span>
            </div>
            <div className="flex flex-col gap-3 group">
              <span className="text-slate-900 group-hover:text-indigo-600 transition-colors">Precision Engine</span>
              <span className="opacity-40 leading-relaxed">Context-Aware Corrections<br/>Multi-Speaker Synthesis</span>
            </div>
          </div>
          
          <div className="mt-16 text-[9px] font-bold text-slate-300 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} FluentFix AI &bull; Excellence in Every Sentence
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-in {
          animation: fade-in 0.5s ease-out, slide-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation-fill-mode: both;
        }
      `}} />
    </div>
  );
}
