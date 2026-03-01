import { useRef, useState, useCallback, useEffect } from "react";

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [elevenLabsAvailable, setElevenLabsAvailable] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const queueRef = useRef<{ text: string; agentName: string }[]>([]);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    fetch("/api/tts/status")
      .then(r => r.json())
      .then(data => setElevenLabsAvailable(data.available))
      .catch(() => setElevenLabsAvailable(false));
  }, []);

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      isProcessingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const item = queueRef.current.shift()!;
    isProcessingRef.current = true;
    setIsSpeaking(true);

    if (elevenLabsAvailable) {
      fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, agentName: item.agentName }),
      })
        .then(res => {
          if (!res.ok) throw new Error("TTS failed");
          return res.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            blobUrlRef.current = null;
            audioRef.current = null;
            playNext();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            blobUrlRef.current = null;
            audioRef.current = null;
            playNext();
          };

          audio.play().catch(() => playNext());
        })
        .catch(() => {
          fallbackSpeak(item.text, () => playNext());
        });
    } else {
      fallbackSpeak(item.text, () => playNext());
    }
  }, [elevenLabsAvailable]);

  const fallbackSpeak = useCallback((text: string, onEnd: () => void) => {
    if (!("speechSynthesis" in window)) {
      onEnd();
      return;
    }

    const cleaned = text
      .replace(/\*\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/[`~]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

    const maxLen = 800;
    const truncated = cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;

    const utterance = new SpeechSynthesisUtterance(truncated);
    utterance.rate = 1.05;
    utterance.onend = onEnd;
    utterance.onerror = () => onEnd();
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback((text: string, agentName: string = "co-founder") => {
    queueRef.current.push({ text, agentName });

    if (!isProcessingRef.current) {
      playNext();
    }
  }, [playNext]);

  const stop = useCallback(() => {
    queueRef.current = [];
    isProcessingRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, elevenLabsAvailable };
}
