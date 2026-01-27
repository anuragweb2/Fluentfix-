
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { correctText, speakText, generateChallenges } from './services/geminiService.ts';
import { AppStatus, CorrectionResult, ToneType, AppMode, Challenge } from './types.ts';
import { Logo, CopyIcon, CheckIcon, EraserIcon, LightningIcon, MicIcon, MicOffIcon } from './components/Icons.tsx';

const TONES: ToneType[] = ['Standard', 'Professional', 'Academic', 'Friendly', 'Casual'];
const STORAGE_KEY = 'fluent_fix_v19_input';

const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 12 8-12 8V4z"/></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>;
const BookIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 6h10"/><path d="M8 10h10"/><path d="M8 14h10"/></svg>;
const PenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;

export default function App() {
  const [mode, setMode] = useState<AppMode>('EDITOR');
  const [inputText, setInputText] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [selectedTone, setSelectedTone] = useState<ToneType>('Standard');
  const [humanize, setHumanize] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
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

  const handleModeSwitch = (newMode: AppMode) => {
    if (newMode === mode) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setResult(null);
      setChallenges([]);
      setSolvedCount(0);
      setStatus(AppStatus.IDLE);
      setIsTransitioning(false);
    }, 600);
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleProcess = useCallback(async () => {
    const val = inputText.trim();
    if (!val || status === AppStatus.LOADING) return;

    setStatus(AppStatus.LOADING);
    setCopied(false);
    if (isPlaying) stopAudio();

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
        setSolvedCount(0);
      }
      setStatus(AppStatus.SUCCESS);
    } catch (e) {
      setStatus(AppStatus.ERROR);
    }
  }, [inputText, selectedTone, status, humanize, isPlaying, mode]);

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

      const dataInt16 = new Int16Array(audioData.buffer);
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
    setChallenges([]);
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

  const [feedback, setFeedback] = useState<{ id: string; correct: boolean } | null>(null);

  const handleAnswer = (challengeId: string, index: number, correctIndex: number) => {
    if (feedback) return;
    const isCorrect = index === correctIndex;
    setFeedback({ id: challengeId, correct: isCorrect });
    if (isCorrect) {
      setTimeout(() => {
        setSolvedCount(prev => prev + 1);
        setFeedback(null);
      }, 1500);
    } else {
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  return (
    <div className={`min-h-screen bg-[#FDFDFD] text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden transition-colors duration-1000 ${mode === 'LEARNING' ? 'bg-[#FDFDFA]' : ''}`}>
      <div className={`fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-20 z-50 transition-all duration-700 ${mode === 'LEARNING' ? 'via-emerald-500' : ''}`} />

      {/* Transition Overlay */}
      <div className={`fixed inset-0 bg-white z-[100] transition-all duration-700 pointer-events-none flex items-center justify-center ${isTransitioning ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}>
        <div className="flex flex-col items-center gap-8">
           <div className={`text-slate-900 scale-[2] animate-bounce ${mode === 'LEARNING' ? 'text-emerald-600' : 'text-indigo-600'}`}>
             <Logo />
           </div>
           <span className="text-xl font-black uppercase tracking-[0.5em] animate-pulse">Switching Studio...</span>
        </div>
      </div>

      <nav className="border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-xl z-40 px-8 py-5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 group cursor-pointer" onClick={() => handleModeSwitch('EDITOR')}>
              <div className={`transition-all duration-500 ${mode === 'LEARNING' ? 'text-emerald-600' : 'text-slate-900 group-hover:text-indigo-600'}`}>
                <Logo />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight leading-none uppercase">
                  FLUENT<span className={mode === 'LEARNING' ? 'text-emerald-600' : 'text-indigo-600'}>FIX</span>
                </span>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">{mode === 'LEARNING' ? 'Learning Lab v2.0' : 'AI Studio v16.0'}</span>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center gap-4 border-l border-slate-100 pl-8">
              <button 
                onClick={() => handleModeSwitch('EDITOR')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${mode === 'EDITOR' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <PenIcon />
                Editor
              </button>
              <button 
                onClick={() => handleModeSwitch('LEARNING')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${mode === 'LEARNING' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <BookIcon />
                Learning
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {mode === 'EDITOR' && (
              <div className="flex items-center gap-4">
                {/* Humanize Toggle */}
                <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase tracking-widest pl-3 opacity-40">Humanize</span>
                  <button 
                    onClick={() => setHumanize(!humanize)} 
                    className={`w-11 h-6 rounded-full transition-all flex items-center px-1 ${humanize ? 'bg-indigo-600 shadow-md shadow-indigo-200' : 'bg-slate-200'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${humanize ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                
                {/* Tone Selectors */}
                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 overflow-x-auto no-scrollbar max-w-full lg:max-w-none">
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
            )}

            {mode === 'LEARNING' && (
               <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Daily Goal</span>
                  <div className="flex gap-1 mt-1">
                     {[1,2,3,4,5].map(i => (
                       <div key={i} className={`w-2 h-2 rounded-full ${i <= solvedCount ? 'bg-emerald-500 animate-pulse' : 'bg-slate-100'}`} />
                     ))}
                  </div>
               </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto w-full p-8 flex-1 grid lg:grid-cols-2 gap-12 my-6 items-stretch">
        <section className={`bg-white rounded-[3rem] flex flex-col transition-all duration-500 border border-black/10 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.01)] focus-within:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.04)] overflow-hidden relative ${mode === 'LEARNING' ? 'focus-within:border-emerald-600/20' : 'focus-within:border-indigo-600/20'}`}>
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className={`scale-75 ${mode === 'LEARNING' ? 'text-emerald-600' : 'text-slate-900'}`}>
                <Logo />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Source Text</h3>
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
              placeholder={mode === 'LEARNING' ? "Write something to learn from your mistakes..." : "Start writing or paste your text here..."} 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
            />
          </div>

          <div className="p-10 flex justify-between items-center bg-slate-50/20">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{inputText.length} characters</span>
            <button 
              onClick={handleProcess} 
              disabled={status === AppStatus.LOADING || !inputText.trim()} 
              className={`px-14 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-4 group ${status === AppStatus.LOADING ? 'bg-slate-100 text-slate-300 cursor-wait' : (mode === 'LEARNING' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-indigo-600 active:scale-[0.98]')}`}
            >
              {status === AppStatus.LOADING ? (
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              ) : (
                <div className="group-hover:rotate-12 transition-transform duration-300"><LightningIcon /></div>
              )}
              {status === AppStatus.LOADING ? 'Processing' : (mode === 'LEARNING' ? 'Create Challenges' : 'Enhance Writing')}
            </button>
          </div>
        </section>

        <section className={`rounded-[3rem] flex flex-col transition-all duration-700 overflow-hidden relative ${result || challenges.length > 0 ? 'bg-white border border-black/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.04)]' : 'bg-slate-50/30 border border-dashed border-black/10'}`}>
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className={`w-1.5 h-6 rounded-full transition-colors duration-500 ${status === AppStatus.SUCCESS ? (mode === 'LEARNING' ? 'bg-emerald-500' : 'bg-indigo-500') : 'bg-slate-200'}`} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                {mode === 'LEARNING' ? 'Learning Studio' : 'Refined Output'}
              </h3>
            </div>
            {result && mode === 'EDITOR' && (
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
            {mode === 'LEARNING' && challenges.length > 0 && (
               <div className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                 {solvedCount} / {challenges.length} Solved
               </div>
            )}
          </div>

          <div className="flex-1 p-12 overflow-y-auto no-scrollbar relative group min-h-[400px]">
            {status === AppStatus.LOADING && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-24 bg-white/60 backdrop-blur-md">
                <div className={`absolute inset-x-0 top-0 h-1.5 shadow-[0_0_15px_rgba(0,0,0,0.2)] animate-[loading-scan_2s_ease-in-out_infinite] ${mode === 'LEARNING' ? 'bg-emerald-600' : 'bg-indigo-600'}`} />
                <div className="flex flex-col items-center gap-6 mt-12">
                   <div className={`animate-pulse scale-125 ${mode === 'LEARNING' ? 'text-emerald-600' : 'text-slate-900'}`}><Logo /></div>
                   <span className={`text-[10px] font-black uppercase tracking-[0.8em] animate-pulse ${mode === 'LEARNING' ? 'text-emerald-900' : 'text-indigo-900'}`}>
                     {mode === 'LEARNING' ? 'Building Curriculum...' : 'Analyzing Linguistics...'}
                   </span>
                </div>
              </div>
            )}
            
            {mode === 'EDITOR' && result ? (
              <div className="text-2xl font-semibold leading-relaxed text-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {result.corrected.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-4' : ''}>{line}</p>
                ))}
              </div>
            ) : mode === 'LEARNING' && challenges.length > 0 ? (
               <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                 {challenges.map((challenge, idx) => {
                   if (idx > solvedCount) return null;
                   const isFeedback = feedback?.id === challenge.id;
                   return (
                     <div key={challenge.id} className={`p-10 rounded-[2.5rem] border border-slate-100 transition-all duration-500 ${idx === solvedCount ? 'bg-white shadow-xl shadow-slate-200/50' : 'bg-slate-50/50 opacity-40 scale-[0.98]'}`}>
                        <div className="flex items-center gap-3 mb-6">
                           <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-widest rounded-full">{challenge.type}</span>
                           <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Exercise {idx + 1}</span>
                        </div>
                        <h4 className="text-xl font-bold mb-8 text-slate-800">Identify the correct way to phrase: <span className="text-emerald-600 italic">"{challenge.originalPart}"</span></h4>
                        <div className="grid gap-3">
                           {challenge.options.map((opt, oidx) => (
                             <button 
                               key={oidx}
                               disabled={idx < solvedCount || isFeedback}
                               onClick={() => handleAnswer(challenge.id, oidx, challenge.correctIndex)}
                               className={`w-full p-5 text-left rounded-2xl text-sm font-bold border transition-all flex justify-between items-center group
                                 ${idx < solvedCount && oidx === challenge.correctIndex ? 'bg-emerald-500 text-white border-emerald-500' : 
                                   isFeedback && feedback?.id === challenge.id && oidx === challenge.correctIndex ? 'bg-emerald-500 text-white border-emerald-500' :
                                   isFeedback && feedback?.id === challenge.id && oidx !== challenge.correctIndex ? 'bg-red-50 text-red-400 border-red-100' :
                                   'bg-white border-slate-100 hover:border-emerald-600 hover:bg-emerald-50 text-slate-600'}`}
                             >
                               {opt}
                               {(idx < solvedCount && oidx === challenge.correctIndex) || (isFeedback && oidx === challenge.correctIndex) ? <CheckIcon /> : null}
                             </button>
                           ))}
                        </div>
                        {idx < solvedCount && (
                          <div className="mt-8 pt-8 border-t border-slate-50">
                             <p className="text-xs font-bold text-slate-400 leading-relaxed"><span className="text-emerald-600 uppercase tracking-widest mr-2">Why?</span> {challenge.explanation}</p>
                          </div>
                        )}
                     </div>
                   );
                 })}
                 {solvedCount === challenges.length && (
                    <div className="p-12 text-center bg-emerald-600 rounded-[3rem] text-white shadow-2xl shadow-emerald-200 animate-in zoom-in duration-500">
                       <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                          <CheckIcon />
                       </div>
                       <h3 className="text-2xl font-black uppercase tracking-widest mb-4">Linguistic Goal Achieved!</h3>
                       <p className="text-emerald-50 text-sm font-bold opacity-80 mb-8">You've mastered these corrections. Keep practicing to build perfect fluency.</p>
                       <button onClick={handleClear} className="px-12 py-4 bg-white text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Start New Session</button>
                    </div>
                 )}
               </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-[0.05] pointer-events-none select-none py-20">
                <div className={`scale-[2.5] mb-12 ${mode === 'LEARNING' ? 'text-emerald-600' : 'text-slate-900'}`}><Logo /></div>
                <p className="text-4xl font-black uppercase tracking-[0.8em]">{mode === 'LEARNING' ? 'Lab Idle' : 'Studio Idle'}</p>
                <p className="mt-4 text-sm font-bold tracking-[0.2em] uppercase">{mode === 'LEARNING' ? 'Waiting for your challenges' : 'Ready for refinement'}</p>
              </div>
            )}
          </div>

          <div className="p-8 text-center border-t border-slate-50 bg-white">
             <div className="flex items-center justify-center gap-6">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">
                  {status === AppStatus.ERROR ? 'Engine Offline' : (status === AppStatus.SUCCESS ? (mode === 'LEARNING' ? 'Curriculum Ready' : 'Precision Analysis: 99%') : 'Awaiting Data')}
                </span>
                {status === AppStatus.SUCCESS && <div className={`h-1.5 w-1.5 rounded-full ${mode === 'LEARNING' ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'}`} />}
             </div>
          </div>
        </section>
      </main>

      <footer className="py-24 border-t border-slate-50 text-center px-8 bg-white mt-12">
        <div className="max-w-[800px] mx-auto">
          <p className="text-sm font-black uppercase tracking-[0.4em] mb-6 transition-colors duration-1000" style={{ color: mode === 'LEARNING' ? '#10b981' : '#6366f1' }}>Where grammar gets graceful by Anurag</p>
          <div className="flex justify-center mb-8">
            <div className={`hover:text-indigo-500/20 transition-all duration-700 scale-150 ${mode === 'LEARNING' ? 'text-emerald-100' : 'text-slate-100'}`}>
              <Logo />
            </div>
          </div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-300 mb-8">Crafted for Excellence</h4>
          <div className="h-[2px] w-24 bg-indigo-500/10 mx-auto rounded-full mb-12" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <div className="space-y-3">
              <p className="text-slate-900">Infrastructure</p>
              <p className="opacity-40">{mode === 'LEARNING' ? 'Gemini 3 Flash' : 'Gemini 3 Flash Engine'}</p>
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

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading-scan {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(400px); opacity: 0; }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
      `}} />
    </div>
  );
}
