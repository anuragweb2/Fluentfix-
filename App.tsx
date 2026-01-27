
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { correctText } from './services/geminiService.ts';
import { AppStatus, CorrectionResult, ToneType } from './types.ts';
import { Logo, CopyIcon, CheckIcon, EraserIcon, LightningIcon, MicIcon, MicOffIcon } from './components/Icons.tsx';

const TONES: ToneType[] = ['Standard', 'Professional', 'Friendly', 'Casual', 'Academic'];
const MAX_CHARS = 5000;
const STORAGE_KEY = 'ff_input';

export default function App() {
  const [inputText, setInputText] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [selectedTone, setSelectedTone] = useState<ToneType>('Standard');
  const [humanize, setHumanize] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, inputText);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
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

    const corrected = await correctText(val, selectedTone, humanize);
    
    setResult({
      id: Date.now().toString(),
      original: val,
      corrected: corrected,
      tone: selectedTone,
      timestamp: Date.now()
    });
    setStatus(AppStatus.SUCCESS);
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
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans">
      <nav className="border-b border-black/5 sticky top-0 bg-white/90 backdrop-blur-md z-40 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-3xl font-black tracking-tighter uppercase">Fluent<span className="text-indigo-600">Fix</span></span>
            </div>
            <div className="hidden sm:flex items-center gap-3 ml-6">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Humanize</span>
              <button onClick={() => setHumanize(!humanize)} className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${humanize ? 'bg-indigo-600' : 'bg-black/10'}`}>
                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${humanize ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-black/5 p-1 rounded-full overflow-x-auto no-scrollbar">
            {TONES.map(t => (
              <button key={t} onClick={() => setSelectedTone(t)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${selectedTone === t ? 'bg-black text-white' : 'text-black/40 hover:text-black'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto w-full p-6 flex-1 grid lg:grid-cols-2 gap-8 items-start">
        {/* Input area */}
        <section className="bg-white border-2 border-black/10 rounded-3xl flex flex-col min-h-[400px] transition-all focus-within:border-black">
          <div className="p-4 border-b border-black/5 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Draft</span>
            <div className="flex gap-2">
              <button onClick={() => { if(isListening) recognitionRef.current?.stop(); else recognitionRef.current?.start(); setIsListening(!isListening); }} className={`p-2 rounded-lg transition-all ${isListening ? 'bg-red-500 text-white' : 'hover:bg-black hover:text-white opacity-40 hover:opacity-100'}`}>
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button onClick={handleClear} className="p-2 opacity-40 hover:opacity-100 hover:text-red-600 transition-all">
                <EraserIcon />
              </button>
            </div>
          </div>
          <textarea ref={textareaRef} className="flex-1 p-8 text-xl font-medium focus:outline-none resize-none bg-transparent placeholder:text-black/5" placeholder="Type or paste text..." value={inputText} onChange={e => setInputText(e.target.value)} />
          <div className="p-6 flex justify-between items-center">
            <span className="text-[10px] font-black opacity-20 uppercase tracking-widest">{inputText.length} chars</span>
            <button onClick={handleCorrect} disabled={status === AppStatus.LOADING || !inputText.trim()} className={`px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${status === AppStatus.LOADING ? 'bg-black/10 text-black/20 cursor-wait' : 'bg-black text-white hover:bg-indigo-600 shadow-lg active:scale-95'}`}>
              {status === AppStatus.LOADING ? <div className="w-3 h-3 border-2 border-black/10 border-t-black rounded-full animate-spin" /> : <LightningIcon />}
              {status === AppStatus.LOADING ? 'Wait' : 'Instant Fix'}
            </button>
          </div>
        </section>

        {/* Output area */}
        <section className={`border-2 rounded-3xl min-h-[400px] flex flex-col transition-all duration-200 ${result ? 'border-black bg-white shadow-xl' : 'border-black/5 bg-slate-50/20'}`}>
          <div className="p-4 border-b border-black/5 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Refined</span>
            {result && (
              <button onClick={handleCopy} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-black text-white hover:bg-indigo-600'}`}>
                {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="flex-1 p-8 overflow-y-auto relative">
            {status === AppStatus.LOADING && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                <div className="flex gap-1.5">
                  {[1,2,3].map(i => <div key={i} className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`}} />)}
                </div>
              </div>
            )}
            {!result && status !== AppStatus.LOADING && (
              <div className="h-full flex flex-col items-center justify-center opacity-5 select-none grayscale"><Logo /></div>
            )}
            {result && (
              <div className="text-xl font-bold leading-relaxed animate-in fade-in duration-300">
                {result.corrected}
              </div>
            )}
          </div>
          <div className="p-6 text-center">
             <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em] select-none">
               {result ? `${result.tone} Mode Optimized` : 'System Idle'}
             </span>
          </div>
        </section>
      </main>

      <footer className="py-20 border-t border-black/5 text-center px-6">
        <h2 className="text-2xl font-black uppercase tracking-[0.5em] mb-4 select-none">Made with love by Anurag</h2>
        <div className="h-1 w-12 bg-indigo-600 mx-auto rounded-full mb-8" />
        <div className="flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest opacity-40">
          <span>Native Velocity</span>
          <span>End-to-End Encryption</span>
          <span>v8.2 STABLE</span>
        </div>
      </footer>
    </div>
  );
}
