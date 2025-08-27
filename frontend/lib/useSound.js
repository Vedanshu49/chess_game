import { useEffect, useRef } from 'react';

export function useSound() {
  const moveAudio = useRef(null);
  const captureAudio = useRef(null);
  const checkAudio = useRef(null);

  useEffect(() => {
    moveAudio.current = new Audio('/sounds/move.mp3');
    captureAudio.current = new Audio('/sounds/capture.mp3');
    checkAudio.current = new Audio('/sounds/check.mp3');
  }, []);

  const playMove = () => moveAudio.current?.play().catch(() => {});
  const playCapture = () => captureAudio.current?.play().catch(() => {});
  const playCheck = () => checkAudio.current?.play().catch(() => {});

  return {
    playMove,
    playCapture,
    playCheck
  };
}
