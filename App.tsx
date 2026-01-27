
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { correctText } from './services/geminiService.ts';
import { AppStatus, CorrectionResult, ToneType } from './types.ts';
import { Logo, CopyIcon, CheckIcon, EraserIcon, LightningIcon, MicIcon, MicOffIcon } from './components/Icons.tsx';

const TONES: ToneType[] = ['Standard', 'Professional', 'Friendly', 'Casual', 'Academic'];
const MAX_CHARS = 5000;
const STORAGE_KEY = 'fluentfix_input_text';
const HISTORY_KEY = 'fluentfix_history';

// History Toggle Icon
const HistoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M20 12h2"/><path d="M2 12h2"/></svg>
);

export default function App() {
  const [inputText, setInputText] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [selectedTone, setSelectedTone] = useState<ToneType>('Standard');
  const [humanize, setHumanize] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [history, setHistory] = useState<CorrectionResult[]>(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, inputText);
  }, [inputText]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
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
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          setInputText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return setError("Speech not supported");
    if (isListening) recognitionRef.current.stop();
    else {
      setError(null);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleCorrect = useCallback(async () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput || status === AppStatus.LOADING) return;

    setStatus(AppStatus.LOADING);
    setError(null);
    setCopied(false);

    try {
      const corrected = await correctText(trimmedInput, selectedTone, humanize);
      const newResult: CorrectionResult = {
        id: Date.now().toString(),
        original: trimmedInput,
        corrected: corrected,
        tone: selectedTone,
        timestamp: Date.now()
      };
      setResult(newResult);
      setHistory(prev => [newResult, ...prev].slice(0, 20));
      setStatus(AppStatus.SUCCESS);
      if (window.innerWidth < 1024) document.getElementById('output-panel')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err: any) {
      setStatus(AppStatus.ERROR);
      setError(err.message || 'Processing failed.');
    }
  }, [inputText, selectedTone, status, humanize]);

  const handleClear = () => {
    setInputText('');
    setResult(null);
    setStatus(AppStatus.IDLE);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    textareaRef.current?.focus();
  };

  const handleCopy = async () => {
    if (result?.corrected) {
      await navigator.clipboard.writeText(result.corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleCorrect(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') { e.preventDefault(); handleClear(); }
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col relative overflow-x-hidden">
      {/* History Sidebar Panel */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-80 bg-slate-50 border-l-2 border-black z-[100] transition-transform duration-500 transform ${showHistory ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black uppercase tracking-[0.2em]">Revision History</h3>
            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-black hover:text-white rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
            {history.length === 0 ? (
              <p className="text-[10px] font-black uppercase text-black/20 text-center mt-20">No history yet</p>
            ) : history.map(item => (
              <div key={item.id} onClick={() => {setResult(item); setInputText(item.original); setShowHistory(false);}} className="p-4 bg-white border border-black/10 rounded-2xl cursor-pointer hover:border-black transition-all group">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[8px] font-black px-1.5 py-0.5 bg-black text-white rounded uppercase">{item.tone}</span>
                  <span className="text-[8px] font-bold text-black/30 uppercase">{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-[11px] font-bold text-black line-clamp-2 leading-relaxed opacity-60 group-hover:opacity-100">{item.corrected}</p>
              </div>
            ))}
          </div>
          <button onClick={() => {setHistory([]); localStorage.removeItem(HISTORY_KEY);}} className="mt-4 w-full py-3 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-600 hover:text-white transition-all">
            Clear History
          </button>
        </div>
      </div>

      <nav className="border-b border-black/10 sticky top-0 bg-white/95 backdrop-blur-sm z-40">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6 self-start md:self-center">
            <div className="flex items-center gap-5 group">
              <div className="transition-transform duration-500 group-hover:rotate-[360deg]"><Logo /></div>
              <span className="text-5xl font-black tracking-tighter uppercase leading-none select-none">Fluent<span className="text-indigo-600">Fix</span></span>
            </div>
            
            {/* Humanize Toggle Switch */}
            <div className="flex items-center gap-3 pl-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-black whitespace-nowrap">Humanize</span>
              <button 
                onClick={() => setHumanize(!humanize)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${humanize ? 'bg-indigo-600' : 'bg-black/20'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${humanize ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-none overflow-x-auto no-scrollbar bg-black/5 p-1 rounded-full border border-black/5 flex items-center gap-1">
              {TONES.map((tone) => (
                <button key={tone} onClick={() => setSelectedTone(tone)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${selectedTone === tone ? 'bg-black text-white shadow-md' : 'text-black/60 hover:text-black hover:bg-black/5'}`}>
                  {tone}
                </button>
              ))}
            </div>
            <button onClick={() => setShowHistory(true)} className="tooltip p-3 bg-white border-2 border-black/5 rounded-full hover:border-black transition-all" data-tip="Revision History">
              <HistoryIcon />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-10 flex-1 w-full flex flex-col lg:grid lg:grid-cols-2 gap-6 lg:gap-10">
        <section className="group flex flex-col bg-white rounded-[2rem] border-2 border-black/10 transition-all duration-300 hover:border-black/20 hover:scale-[1.01] focus-within:border-black focus-within:ring-8 focus-within:ring-black/5 overflow-hidden">
          <header className="px-6 py-4 border-b-2 border-black/10 flex justify-between items-center bg-slate-50">
            <h2 className="text-[11px] font-black text-black/40 uppercase tracking-[0.2em]">Source Content</h2>
            <div className="flex items-center gap-2">
              <button onClick={toggleListening} className={`tooltip p-2 rounded-xl transition-all ${isListening ? 'bg-red-600 text-white animate-pulse' : 'text-black/40 hover:bg-black hover:text-white'}`} data-tip={isListening ? "Stop Voice" : "Voice Input"}>
                {isListening ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button onClick={handleClear} disabled={!inputText} className="tooltip p-2 hover:bg-red-600 hover:text-white rounded-xl text-black/40 transition-all disabled:opacity-0" data-tip="Clear (Ctrl+Bksp)">
                <EraserIcon />
              </button>
            </div>
          </header>
          <div className="flex-1 p-6 md:p-10">
            <textarea ref={textareaRef} maxLength={MAX_CHARS} className="w-full text-xl md:text-2xl leading-relaxed bg-transparent focus:outline-none resize-none placeholder:text-black/10 font-medium text-black min-h-[300px]" placeholder="Paste text here..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <footer className="p-6 border-t-2 border-black/10 flex justify-between items-center bg-white">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-24 bg-black/5 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-300 ${inputText.length > MAX_CHARS * 0.9 ? 'bg-red-500' : 'bg-black'}`} style={{ width: `${(inputText.length / MAX_CHARS) * 100}%` }} />
              </div>
              <span className="text-[10px] font-black uppercase text-black/40 tracking-widest">{inputText.length} / {MAX_CHARS}</span>
            </div>
            <button onClick={handleCorrect} disabled={status === AppStatus.LOADING || !inputText.trim()} className={`tooltip px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all flex items-center gap-3 ${status === AppStatus.LOADING ? 'bg-black/5 text-black/20' : 'bg-black text-white hover:bg-indigo-600 shadow-xl'}`} data-tip="Improve (Ctrl+Enter)">
              {status === AppStatus.LOADING ? <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" /> : <LightningIcon />}
              {status === AppStatus.LOADING ? "Analysing" : "Refine Text"}
            </button>
          </footer>
        </section>

        <section id="output-panel" className={`group relative flex flex-col bg-white rounded-[2rem] border-2 transition-all duration-500 overflow-hidden hover:scale-[1.01] ${result ? 'border-black shadow-2xl' : 'border-black/10 bg-black/[0.01]'}`}>
          <header className="px-6 py-4 border-b-2 border-black/10 flex justify-between items-center bg-slate-50 z-10">
            <h2 className="text-[11px] font-black text-black/40 uppercase tracking-[0.2em]">Refined Output</h2>
            {result && (
              <div className="flex items-center gap-2">
                {copied && <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest animate-in fade-in slide-in-from-right-1">Copied</span>}
                <button onClick={handleCopy} className={`tooltip flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-black text-white hover:bg-indigo-600'}`} data-tip="Copy Result">
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {!copied && 'Copy'}
                </button>
              </div>
            )}
          </header>

          <div className="flex-1 p-6 md:p-10 overflow-y-auto relative min-h-[300px]">
            {status === AppStatus.LOADING && (
              <div className="absolute inset-0 z-0 pointer-events-none bg-indigo-50/20">
                <div className="neural-line absolute top-0 left-0 w-full h-[20%] bg-gradient-to-b from-indigo-500/10 to-transparent blur-md" />
                <div className="neural-line absolute top-0 left-0 w-full h-1 bg-indigo-600/30" />
                <div className="flex flex-col items-center justify-center h-full opacity-40">
                   <div className="flex gap-1">
                      {[1,2,3].map(i => <div key={i} className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: `${i*0.2}s`}} />)}
                   </div>
                   <span className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-900">Neural Synthesis Active</span>
                </div>
              </div>
            )}

            {!result && !error && status !== AppStatus.LOADING && (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-5">
                <Logo />
              </div>
            )}

            {error && <div className="p-8 text-center text-red-600 font-bold bg-red-50 rounded-3xl border-2 border-red-100">{error}</div>}

            {result && (
              <div className="text-xl md:text-2xl leading-relaxed text-black font-bold whitespace-pre-wrap animate-in fade-in slide-in-from-bottom-6 duration-700">
                {result.corrected}
              </div>
            )}
          </div>
          
          <footer className="p-6 border-t-2 border-black/10 bg-slate-50/50 text-center min-h-[88px] flex items-center justify-center">
            {result ? (
              <span className="text-[9px] font-black text-black/30 uppercase tracking-[0.3em] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Optimised for {result.tone} Clarity
              </span>
            ) : (
              <span className="text-[9px] font-black text-black/5 uppercase tracking-[0.3em] select-none italic">Awaiting Submission</span>
            )}
          </footer>
        </section>
      </main>

      <footer className="py-20 border-t border-black/5 bg-slate-50/50">
        <div className="max-w-[1440px] mx-auto px-6 flex flex-col items-center gap-12">
          {/* Centered Main Attribution */}
          <div className="text-center group flex flex-col items-center gap-4">
             <p className="text-2xl font-black text-black uppercase tracking-[0.4em] transition-all duration-500 group-hover:scale-105 select-none">
               Made with love by Anurag
             </p>
             <div className="h-1.5 w-16 bg-indigo-600 rounded-full transition-all duration-500 group-hover:w-32" />
          </div>
          
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-black text-black uppercase tracking-[0.4em]">&copy; {new Date().getFullYear()} FluentFix Protocol — v6.0 CORE</span>
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em]">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span>Secure Sync On</span></div>
              <a href="#" className="hover:text-indigo-600 transition-colors underline decoration-black/20 underline-offset-4">Documentation</a>
              <a href="#" className="hover:text-indigo-600 transition-colors underline decoration-black/20 underline-offset-4">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
