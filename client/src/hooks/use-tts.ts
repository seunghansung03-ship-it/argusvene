import { useRef, useState, useCallback } from "react";

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const cleaned = text
      .replace(/\*\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/[`~]/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

    if (!cleaned) return;

    const maxLen = 800;
    const truncated = cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;

    const utterance = new SpeechSynthesisUtterance(truncated);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      v => v.lang.startsWith("en") && v.name.toLowerCase().includes("google")
    ) || voices.find(v => v.lang.startsWith("en")) || voices[0];

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      onEnd?.();
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
