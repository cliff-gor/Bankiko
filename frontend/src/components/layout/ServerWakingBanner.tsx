"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * Shown when the API is unavailable (Render cold start / 502).
 * Auto-refreshes the page every 10s until the server is back.
 */
export function ServerWakingBanner() {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.location.reload();
          return 10;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border rounded-2xl p-8 shadow-lg max-w-sm w-full mx-4 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-lg">Server is starting up</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The backend is waking from sleep. This takes about 30–60 seconds on first load.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Retrying in <span className="font-mono font-semibold text-foreground">{countdown}s</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 w-full border rounded-lg py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry now
        </button>
      </div>
    </div>
  );
}
