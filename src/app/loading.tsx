'use client';

// HYDRATION-INDEPENDENT LOADING SCREEN
// Uses CSS Animations (Compositor Thread) instead of JS State (Main Thread)

export default function Loading() {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f8f5e6] text-[#1e3a8a] p-4 font-mono relative overflow-hidden">

            {/* 1. INJECTED CSS ANIMATIONS (Instant Run) */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes bootProgress {
          0% { width: 5%; }
          20% { width: 45%; }     
          50% { width: 75%; }      
          80% { width: 85%; }      
          100% { width: 98%; }     
        }
        .animate-boot-bar {
          animation: bootProgress 3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}} />

            {/* 2. RETRO CRT OVERLAY EFFECTS */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_4px,6px_100%]"></div>

            {/* 3. MAIN TERMINAL CARD */}
            <div className="w-full max-w-md border-2 border-[#1e3a8a] bg-[#f8f5e6] shadow-[8px_8px_0px_#1e3a8a] relative z-20">

                {/* Header Bar */}
                <div className="bg-[#1e3a8a] text-[#f8f5e6] px-3 py-2 flex justify-between items-center border-b border-[#1e3a8a]">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#ef4444] border border-[#f8f5e6]"></div>
                        <span className="text-xs font-bold tracking-widest uppercase">Sec_Relay_04</span>
                    </div>
                    <span className="text-[10px] opacity-70">V 2.0.4</span>
                </div>

                {/* Content Area */}
                <div className="p-6 space-y-6">

                    {/* ASCII Art / Header */}
                    <div className="border border-[#1e3a8a] border-dashed p-2 opacity-60">
                        <pre className="text-[9px] leading-[1.1] font-bold">
                            {`   SYSTEM: BORDER_CLASH
   TARGET: PUBLIC_INTERFACE
   STATUS: INITIALIZING...`}
                        </pre>
                    </div>

                    {/* The Loader */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                            <span>Decryption_Progress</span>
                            <span className="animate-pulse">_</span>
                        </div>

                        {/* Visual Bar */}
                        <div className="h-8 border-2 border-[#1e3a8a] p-1 bg-white">
                            <div
                                className="h-full bg-[#1e3a8a] animate-boot-bar relative"
                                style={{ width: '5%' }}
                            >
                                {/* Segmented Look using masked stripes */}
                                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,#f8f5e6_4px,#f8f5e6_6px)]"></div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Stats */}
                    <div className="grid grid-cols-3 gap-2 text-[9px] uppercase font-bold tracking-tight opacity-75">
                        <div className="text-center border border-[#1e3a8a]/20 p-1">
                            LATENCY<br />
                            <span className="text-[#1e3a8a]">12ms</span>
                        </div>
                        <div className="text-center border border-[#1e3a8a]/20 p-1">
                            ENCRYPTION<br />
                            <span className="text-[#1e3a8a]">AES-256</span>
                        </div>
                        <div className="text-center border border-[#1e3a8a]/20 p-1 text-[#ef4444]">
                            STATUS<br />
                            <span>LOCKED</span>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}
