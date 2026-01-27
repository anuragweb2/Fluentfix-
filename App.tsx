
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { correctText } from './services/geminiService.ts';
import { AppStatus, CorrectionResult, ToneType } from './types.ts';
import { Logo, CopyIcon, CheckIcon, EraserIcon, LightningIcon, MicIcon, MicOffIcon } from './components/Icons.tsx';

const TONES: ToneType[] = ['Standard', 'Professional', 'Friendly', 'Casual', 'Academic'];
const STORAGE_KEY = 'ff_v11_input';

export default function App() {
  const [inputText, setInputText] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [selectedTone, setSelectedTone] = useState<ToneType>('Standard');
  const [humanize, setHumanize] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

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
    } catch (e: any) {
      console.error(e);
      if (e.message === "API_KEY_MISSING" || e.message === "API_KEY_INVALID") {
        setShowKeyPrompt(true);
        setStatus(AppStatus.IDLE);
      } else {
        setStatus(AppStatus.ERROR);
      }
    }
  }, [inputText, selectedTone, status, humanize]);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setShowKeyPrompt(false);
      handleCorrect();
    }
  };

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

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans selection:bg-black selection:text-white">
      {showKeyPrompt && (
        <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="max-w-md w-full space-y-8">
            <div className="flex justify-center scale-125"><Logo /></div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">API Key Required</h1>
            <p className="text-black/60 font-medium">To run this in the browser, you must select an API key. This will be securely injected into your session.</p>
            <button onClick={handleSelectKey} className="w-full py-5 bg-black text-white rounded-3xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-2xl">
              Select API Key
            </button>
          </div>
        </div>
      )}

      <nav className="border-b border-black/5 sticky top-0 bg-white/95 backdrop-blur-md z-40 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-4xl font-black tracking-tighter uppercase leading-none">Fluent<span className="text-indigo-600">Fix</span></span>
            </div>
            <div className="flex items-center gap-3 border-l border-black/10 pl-6">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Humanize</span>
              <button onClick={() => setHumanize(!humanize)} className={`w-10 h-5 rounded-full transition-all flex items-center px-1 ${humanize ? 'bg-indigo-600' : 'bg-black/10'}`}>
                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${humanize ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-black/[0.03] p-1 rounded-full border border-black/5">
            {TONES.map(t => (
              <button key={t} onClick={() => setSelectedTone(t)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${selectedTone === t ? 'bg-black text-white shadow-lg' : 'text-black/40 hover:text-black'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto w-full p-6 flex-1 grid lg:grid-cols-2 gap-8 my-4">
        <section className="bg-white border-2 border-black/10 rounded-[2rem] flex flex-col transition-all focus-within:border-black">
          <div className="p-4 border-b border-black/5 flex justify-between items-center px-8 bg-slate-50/50 rounded-t-[2rem]">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Draft</span>
            <div className="flex gap-2">
              <button onClick={() => { if(isListening) recognitionRef.current?.stop(); else recognitionRef.current?.start(); setIsListening(!isListening); }} className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-black hover:text-white opacity-40 hover:opacity-100'}`}>
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button onClick={handleClear} className="p-2 opacity-40 hover:opacity-100 hover:text-red-600 transition-all rounded-xl">
                <EraserIcon />
              </button>
            </div>
          </div>
          <textarea ref={textareaRef} className="flex-1 p-8 text-2xl font-bold focus:outline-none resize-none bg-transparent placeholder:text-black/5 no-scrollbar" placeholder="Paste text..." value={inputText} onChange={e => setInputText(e.target.value)} />
          <div className="p-6 flex justify-between items-center">
            <span className="text-[10px] font-black opacity-20 uppercase tracking-widest">{inputText.length} chars</span>
            <button onClick={handleCorrect} disabled={status === AppStatus.LOADING || !inputText.trim()} className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${status === AppStatus.LOADING ? 'bg-black/5 text-black/20' : 'bg-black text-white hover:bg-indigo-600 shadow-xl active:scale-95'}`}>
              {status === AppStatus.LOADING ? <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" /> : <LightningIcon />}
              {status === AppStatus.LOADING ? 'Analysing' : 'Fix Now'}
            </button>
          </div>
        </section>

        <section className={`border-2 rounded-[2rem] flex flex-col transition-all duration-200 ${result ? 'border-black bg-white shadow-2xl' : 'border-black/5 bg-slate-50/10'}`}>
          <div className="p-4 border-b border-black/5 flex justify-between items-center px-8 bg-slate-50/50 rounded-t-[2rem]">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Refined</span>
            {result && (
              <button onClick={handleCopy} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-black text-white hover:bg-indigo-600'}`}>
                {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="flex-1 p-8 overflow-y-auto no-scrollbar relative min-h-[400px]">
            {status === AppStatus.LOADING && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <div className="flex gap-1">
                  {[1,2,3].map(i => <div key={i} className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`}} />)}
                </div>
              </div>
            )}
            {result && (
              <div className="text-2xl font-black leading-relaxed text-black animate-in fade-in duration-200">
                {result.corrected}
              </div>
            )}
            {!result && status !== AppStatus.LOADING && (
              <div className="h-full flex items-center justify-center opacity-[0.02] select-none pointer-events-none scale-150"><Logo /></div>
            )}
          </div>
          <div className="p-6 text-center border-t border-black/5">
             <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em]">
               {result ? 'Correction Delivered' : 'System Ready'}
             </span>
          </div>
        </section>
      </main>

      <footer className="py-20 border-t border-black/5 text-center px-6">
        <h2 className="text-3xl font-black uppercase tracking-[0.5em] mb-4 select-none">Made with love by Anurag</h2>
        <div className="h-1.5 w-16 bg-indigo-600 mx-auto rounded-full mb-8" />
        <div className="flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest opacity-30">
          <span>v11.0 CORE</span>
          <span>Hyper-Speed Delivery</span>
          <span>Privacy Secured</span>
        </div>
      </footer>
    </div>
  );
}
