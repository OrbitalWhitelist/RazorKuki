import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetBotStatus, getGetBotStatusQueryKey } from "@workspace/api-client-react";
import { formatDistanceToNow, format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Terminal, Activity, ZapOff } from 'lucide-react';

const queryClient = new QueryClient();

function StatusDashboard() {
  const [progress, setProgress] = useState(100);
  const REFETCH_INTERVAL = 15000;

  const { data, isLoading, isError, dataUpdatedAt } = useGetBotStatus({
    query: { refetchInterval: REFETCH_INTERVAL, queryKey: getGetBotStatusQueryKey() }
  });

  // Calculate countdown progress for the 15s refetch ring
  useEffect(() => {
    let animationFrameId: number;
    let startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, REFETCH_INTERVAL - elapsed);
      const percentage = (remaining / REFETCH_INTERVAL) * 100;
      
      setProgress(percentage);

      if (elapsed < REFETCH_INTERVAL) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Reset and restart animation when interval completes
        // React Query will fetch in parallel
        startTime = Date.now();
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [dataUpdatedAt]);

  const online = data?.online ?? false;
  const tag = data?.tag ?? "UNKNOWN TAG";
  const readyAt = data?.readyAt ? new Date(data.readyAt) : null;

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 relative">
      <div className="noise-overlay" />
      <div className="scanline-overlay" />
      
      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center">
        
        {/* Main Interface Box */}
        <div className="relative bg-black/60 backdrop-blur-md border border-border p-10 w-full animate-in fade-in zoom-in duration-700 ease-out flex flex-col items-center text-center">
          <div className="corner-tl corner-border" />
          <div className="corner-tr corner-border" />
          <div className="corner-bl corner-border" />
          <div className="corner-br corner-border" />

          {/* Header */}
          <div className="flex items-center gap-3 mb-10 text-muted-foreground">
            <Terminal className="w-5 h-5 opacity-70" />
            <h1 className="text-sm font-mono tracking-[0.3em] uppercase opacity-80">Razor Tools</h1>
          </div>

          {/* Main Status */}
          {isLoading && !data ? (
            <div className="flex flex-col items-center space-y-6 my-10">
              <div className="w-16 h-16 rounded-full border border-muted flex items-center justify-center animate-pulse">
                <Activity className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-xl font-sans tracking-widest text-muted-foreground uppercase animate-pulse">
                Establishing uplink...
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
              
              {/* Indicator */}
              <div className="mb-8">
                {online ? (
                  <div className="pulse-indicator online w-20 h-20 rounded-full bg-success flex items-center justify-center shadow-[0_0_30px_rgba(0,255,102,0.3)] border-2 border-success/50">
                    <Activity className="w-8 h-8 text-black" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center border-2 border-danger shadow-[0_0_20px_rgba(255,0,51,0.2)]">
                    <ZapOff className="w-8 h-8 text-danger" strokeWidth={2} />
                  </div>
                )}
              </div>

              {/* Status Text */}
              <div className="flex flex-col items-center space-y-2 mb-8">
                {online ? (
                  <>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white uppercase drop-shadow-md">
                      System Online
                    </h2>
                    <div className="font-mono text-success text-sm tracking-widest bg-success/10 px-4 py-1 mt-2 border border-success/20">
                      ID: {tag}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-danger uppercase drop-shadow-md">
                      System Offline
                    </h2>
                    <div className="font-mono text-danger/80 text-sm tracking-widest bg-danger/10 px-4 py-1 mt-2 border border-danger/20">
                      BOT IS CURRENTLY OFFLINE
                    </div>
                  </>
                )}
              </div>

              {/* Uptime (if online) */}
              {online && readyAt && (
                <div className="flex flex-col items-center mt-2 p-6 border-t border-border w-full">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.2em] mb-3">
                    Uptime Duration
                  </div>
                  <div className="text-xl md:text-2xl font-mono text-white/90">
                    {formatDistanceToNow(readyAt)}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer info (Last checked + countdown) */}
        <div className="mt-8 flex items-center justify-between w-full max-w-sm text-xs font-mono text-muted-foreground animate-in fade-in duration-1000 delay-500 fill-mode-both">
          <div className="flex items-center gap-2">
            <span className="opacity-50">LAST PING:</span>
            <span className="text-white/60">
              {dataUpdatedAt ? format(dataUpdatedAt, 'HH:mm:ss.SSS') : 'WAITING...'}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="opacity-50">REFRESHING</span>
            <div className="relative w-6 h-6 flex items-center justify-center">
              <svg className="w-full h-full timer-ring" viewBox="0 0 100 100">
                <circle
                  className="text-muted/40"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="45"
                  cx="50"
                  cy="50"
                />
                <circle
                  className="text-white/40"
                  strokeWidth="8"
                  strokeDasharray={283}
                  strokeDashoffset={283 - (283 * progress) / 100}
                  strokeLinecap="square"
                  stroke="currentColor"
                  fill="transparent"
                  r="45"
                  cx="50"
                  cy="50"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusDashboard />
    </QueryClientProvider>
  );
}

export default App;
