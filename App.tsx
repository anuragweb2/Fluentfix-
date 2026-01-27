
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { correctText } from './services/geminiService.ts';
import { AppStatus, CorrectionResult, ToneType } from './types.ts';
import { Logo, CopyIcon, CheckIcon, EraserIcon, LightningIcon, MicIcon, MicOffIcon } from './components/Icons.tsx';

const TONES: ToneType[] = ['Standard', 'Professional', 'Friendly', 'Casual', 'Academic'];
const MAX_CHARS = 5000;
const STORAGE_KEY = 'ff_fast_input';

export default function App() {
  const [inputText, setInputText] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [selectedTone, setSelectedTone] = useState<ToneType>('Standard');
  const [humanize, setHumanize] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check for API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && !process.env.API_KEY) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) setNeedsKey(true);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setNeedsKey(false); // Proceed to app after dialog
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, inputText);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(300, textareaRef.current.scrollHeight)}px`;
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

  const handleCorrect = useCallback(async () => {
    const val = inputText.trim();
    if (!val || status === AppStatus.LOADING) return;

    setStatus(AppStatus.LOADING);
    setCopied(false);

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
      console.error(e);
      setStatus(AppStatus.ERROR);
    }
  }, [inputText, selectedTone, status, humanize]);

  const handleClear = () => {
    setInputText('');
    setResult(null);
    setStatus(AppStatus.IDLE);
    textareaRef.current?.focus();
  };

  const handleCopy = async () => {
    if (result?.corrected) {
      await navigator.clipboard.writeText(result.corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    }
  };

  if (needsKey) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8">
          <div className="flex justify-center mb-6"><Logo /></div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Initialize AI Service</h1>
          <p className="text-black/60 font-medium">To provide high-speed corrections, please connect your AI account. This uses your own project quota.</p>
          <button onClick={handleOpenKeyDialog} className="w-full py-5 bg-black text-white rounded-3xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-2xl">
            Connect AI Service
          </button>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-20">Securely managed via Google AI Studio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      <nav className="border-b border-black/5 sticky top-0 bg-white/95 backdrop-blur-md z-40 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-4xl font-black tracking-tighter uppercase leading-none">Fluent<span className="text-indigo-600">Fix</span></span>
            </div>
            <div className="h-8 w-[1px] bg-black/5 mx-2 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Humanize</span>
              <button onClick={() => setHumanize(!humanize)} className={`w-12 h-6 rounded-full transition-all flex items-center px-1.5 ${humanize ? 'bg-indigo-600 shadow-inner' : 'bg-black/10'}`}>
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform duration-200 ${humanize ? 'translate-x-5.5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-black/[0.03] p-1.5 rounded-full overflow-x-auto no-scrollbar border border-black/5">
            {TONES.map(t => (
              <button key={t} onClick={() => setSelectedTone(t)} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedTone === t ? 'bg-black text-white shadow-xl' : 'text-black/40 hover:text-black hover:bg-black/5'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto w-full p-6 flex-1 grid lg:grid-cols-2 gap-10 items-stretch my-6">
        {/* Input Panel */}
        <section className="bg-white border-[3px] border-black/10 rounded-[2.5rem] flex flex-col transition-all focus-within:border-black focus-within:ring-[12px] focus-within:ring-black/5">
          <div className="p-6 border-b border-black/5 flex justify-between items-center bg-slate-50/30 rounded-t-[2.5rem]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-black/20" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Source Text</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { if(isListening) recognitionRef.current?.stop(); else recognitionRef.current?.start(); setIsListening(!isListening); }} className={`p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-black hover:text-white opacity-40 hover:opacity-100'}`}>
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button onClick={handleClear} className="p-2.5 opacity-40 hover:opacity-100 hover:text-red-600 transition-all rounded-xl">
                <EraserIcon />
              </button>
            </div>
          </div>
          <textarea ref={textareaRef} className="flex-1 p-10 text-2xl font-semibold focus:outline-none resize-none bg-transparent placeholder:text-black/10 leading-relaxed" placeholder="Write or paste here..." value={inputText} onChange={e => setInputText(e.target.value)} />
          <div className="p-8 flex justify-between items-center">
            <span className="text-[11px] font-black opacity-20 uppercase tracking-widest">{inputText.length} Character Count</span>
            <button onClick={handleCorrect} disabled={status === AppStatus.LOADING || !inputText.trim()} className={`px-14 py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all flex items-center gap-4 ${status === AppStatus.LOADING ? 'bg-black/5 text-black/20 cursor-wait' : 'bg-black text-white hover:bg-indigo-600 shadow-2xl active:scale-95'}`}>
              {status === AppStatus.LOADING ? <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" /> : <LightningIcon />}
              {status === AppStatus.LOADING ? 'Analysing' : 'Fix Instantly'}
            </button>
          </div>
        </section>

        {/* Output Panel */}
        <section className={`border-[3px] rounded-[2.5rem] flex flex-col transition-all duration-300 ${result ? 'border-black bg-white shadow-2xl scale-[1.02]' : 'border-black/5 bg-slate-50/10'}`}>
          <div className="p-6 border-b border-black/5 flex justify-between items-center bg-slate-50/30 rounded-t-[2.5rem]">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${result ? 'bg-indigo-600' : 'bg-black/20'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Refined Content</span>
            </div>
            {result && (
              <button onClick={handleCopy} className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-black text-white hover:bg-indigo-600 shadow-lg'}`}>
                {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied to clipboard' : 'Copy result'}
              </button>
            )}
          </div>
          <div className="flex-1 p-10 overflow-y-auto relative min-h-[400px]">
            {status === AppStatus.LOADING && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 z-10 backdrop-blur-[1px]">
                <div className="flex gap-2">
                  {[1,2,3,4].map(i => <div key={i} className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`}} />)}
                </div>
              </div>
            )}
            {!result && status !== AppStatus.LOADING && (
              <div className="h-full flex flex-col items-center justify-center opacity-[0.02] select-none pointer-events-none scale-150"><Logo /></div>
            )}
            {result && (
              <div className="text-2xl font-bold leading-relaxed text-black animate-in fade-in zoom-in-95 duration-200">
                {result.corrected}
              </div>
            )}
          </div>
          <div className="p-8 text-center bg-slate-50/30 rounded-b-[2.5rem] border-t border-black/5">
             {result ? (
               <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.5em] flex items-center justify-center gap-3">
                 <LightningIcon /> Ready for Production
               </span>
             ) : (
               <div className="flex items-center justify-center gap-4 opacity-10">
                 <div className="h-1.5 w-1.5 bg-black rounded-full animate-pulse" />
                 <div className="h-1.5 w-1.5 bg-black rounded-full animate-pulse" style={{animationDelay: '0.1s'}} />
                 <div className="h-1.5 w-1.5 bg-black rounded-full animate-pulse" style={{animationDelay: '0.2s'}} />
               </div>
             )}
          </div>
        </section>
      </main>

      <footer className="py-24 border-t border-black/5 text-center px-6 mt-12 bg-slate-50/20">
        <div className="group cursor-default inline-block">
          <h2 className="text-4xl font-black uppercase tracking-[0.6em] mb-6 select-none transition-all group-hover:tracking-[0.8em]">Made with love by Anurag</h2>
          <div className="h-2 w-32 bg-indigo-600 mx-auto rounded-full transition-all group-hover:w-64" />
        </div>
        <div className="flex flex-wrap justify-center gap-12 mt-16 text-[11px] font-black uppercase tracking-widest opacity-30">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Ultra-Fast Delivery</span>
          <span>End-to-End Privacy</span>
          <span>v9.0 ENTERPRISE</span>
        </div>
      </footer>
    </div>
  );
}
