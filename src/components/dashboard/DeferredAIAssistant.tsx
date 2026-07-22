"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AIAssistant = dynamic(() => import("./AIAssistant"), {
  ssr: false,
});

export default function DeferredAIAssistant() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setReady(true), 600);
    return () => window.clearTimeout(timeout);
  }, []);

  return ready ? <AIAssistant /> : null;
}
