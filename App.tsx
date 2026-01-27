
import React, { useState, useRef, useEffect } from 'react';
import { correctText } from './services/geminiService';
import { AppStatus, CorrectionResult, ToneType } from './types';
import { Logo, CopyIcon, CheckIcon, EraserIcon, LightningIcon } from './components/Icons';

const TONES: ToneType[] = ['Professional', 'Friendly', 'Casual', 'Academic', 'Standard'];

export default function App() {
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState<ToneType>('Standard');
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  const handleCorrect = async () => {
    if (!inputText.trim()) return;

    setStatus(AppStatus.LOADING);
    setError(null);
    setCopied(false);

    try {
      const corrected = await correctText(inputText, selectedTone);
      setResult({
        original: inputText,
        corrected: corrected,
        tone: selectedTone,
        timestamp: Date.now()
      });
      setStatus(AppStatus.SUCCESS);
      
      // On mobile, scroll to result if it exists after correction
      if (window.innerWidth < 1024) {
        setTimeout(() => {
          document.getElementById('output-panel')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err: any) {
      setStatus(AppStatus.ERROR);
      setError(err.message || 'Error refining text. Please check your connection.');
    }
  };

  const handleClear = () => {
    setInputText('');
    setResult(null);
    setStatus(AppStatus.IDLE);
    setError(null);
    setCopied(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleCopy = () => {
    if (result?.corrected) {
      navigator.clipboard.writeText(result.corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
      {/* Top Navigation */}
      <nav className="border-b border-black/10 sticky top-0 bg-white/90 backdrop-blur-md z-50">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="scale-75 origin-left">
              <Logo />
            </div>
            <span className="text-lg font-black tracking-tighter text-black">
              Fluent<span className="text-indigo-600">Fix</span>
            </span>
          </div>

          <div className="w-full sm:w-auto overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-1.5 pb-1 sm:pb-0">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  onClick={() => setSelectedTone(tone)}
                  className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all border whitespace-nowrap
                    ${selectedTone === tone 
                      ? 'bg-black text-white border-black shadow-sm' 
                      : 'bg-white text-black border-black/20 hover:border-black/60 hover:text-black'
                    }
                  `}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8 flex-1 w-full">
        {/* Grid uses items-stretch to keep boxes equal length */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-stretch">
          
          {/* Input Panel */}
          <div className="flex flex-col bg-white rounded-2xl md:rounded-3xl border-[1.5px] border-black/40 overflow-hidden transition-all focus-within:ring-4 focus-within:ring-indigo-600/10 focus-within:border-black">
            <div className="px-4 md:px-6 py-3 border-b-[1.5px] border-black/40 flex justify-between items-center bg-slate-50">
              <span className="text-[10px] font-black text-black uppercase tracking-widest">Input</span>
              <button 
                onClick={handleClear}
                className="p-1.5 hover:bg-black hover:text-white rounded-lg text-black transition-colors"
                aria-label="Clear input"
              >
                <EraserIcon />
              </button>
            </div>
            
            <div className="flex-1 p-5 md:p-8 bg-transparent">
              <textarea
                ref={textareaRef}
                className="w-full text-lg md:text-xl lg:text-2xl leading-relaxed bg-transparent focus:outline-none resize-none placeholder:text-black/30 font-medium text-black min-h-[200px]"
                placeholder="Enter text to improve..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <div className="p-4 md:p-6 bg-white border-t-[1.5px] border-black/40 flex justify-between items-center mt-auto">
              <span className="text-[10px] font-black text-black uppercase tracking-widest">
                {inputText.length} characters
              </span>
              <button
                onClick={handleCorrect}
                disabled={status === AppStatus.LOADING || !inputText.trim()}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all
                  ${status === AppStatus.LOADING 
                    ? 'bg-black/10 cursor-not-allowed text-black/30' 
                    : 'bg-black hover:bg-indigo-700 text-white shadow-lg active:scale-95'
                  }
                `}
              >
                {status === AppStatus.LOADING ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Fixing
                  </>
                ) : (
                  <>
                    <LightningIcon />
                    Improve
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Output Panel - Matches Input Height */}
          <div 
            id="output-panel"
            className={`flex flex-col bg-white rounded-2xl md:rounded-3xl border-[1.5px] transition-all overflow-hidden min-h-[200px]
              ${result ? 'border-black/60 shadow-xl' : 'border-black/20 bg-slate-50/10'}
            `}
          >
            <div className="px-4 md:px-6 py-3 border-b-[1.5px] border-black/40 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-black uppercase tracking-widest">Output</span>
                {result && (
                  <span className="px-1.5 py-0.5 rounded bg-black text-[8px] font-bold text-white uppercase tracking-tighter border border-black">
                    {result.tone}
                  </span>
                )}
              </div>
              {result && (
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                    ${copied 
                      ? 'bg-emerald-600 text-white border-emerald-600' 
                      : 'bg-black text-white hover:bg-indigo-600'
                    }
                  `}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? 'Copied' : 'Copy Result'}
                </button>
              )}
            </div>

            <div className="flex-1 p-5 md:p-8 bg-transparent">
              {!result && !error && status !== AppStatus.LOADING && (
                <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-10 h-10 rounded-full border-2 border-black/40 border-dashed animate-[spin_8s_linear_infinite]"></div>
                  <p className="text-sm font-black text-black uppercase tracking-widest">Awaiting Input</p>
                </div>
              )}

              {status === AppStatus.LOADING && (
                <div className="space-y-4">
                  <div className="h-4 md:h-5 bg-black/5 rounded-full w-3/4 animate-pulse"></div>
                  <div className="h-4 md:h-5 bg-black/5 rounded-full w-full animate-pulse"></div>
                  <div className="h-4 md:h-5 bg-black/5 rounded-full w-5/6 animate-pulse"></div>
                </div>
              )}

              {error && (
                <div className="text-white text-sm font-black p-4 bg-black rounded-xl border-2 border-black flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {result && (
                <div className="text-lg md:text-xl lg:text-2xl leading-relaxed text-black font-bold whitespace-pre-wrap animate-in fade-in slide-in-from-top-2 duration-500">
                  {result.corrected}
                </div>
              )}
            </div>
            
            {/* Matching spacer for alignment */}
            <div className="p-4 md:p-6 border-t-[1.5px] border-transparent bg-transparent invisible h-[68px] sm:h-[72px]"></div>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-[9px] font-black text-black uppercase tracking-[0.3em] mt-auto">
        FluentFix Protocol 3.6 — Refined Contrast
      </footer>
    </div>
  );
}
