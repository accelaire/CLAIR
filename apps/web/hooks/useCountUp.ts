import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  duration?: number;
  startOnMount?: boolean;
  decimals?: number;
}

export function useCountUp(
  end: number | undefined,
  options: UseCountUpOptions = {}
) {
  const { duration = 1000, startOnMount = true, decimals = 0 } = options;
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    if (end === undefined || end === null || !startOnMount) return;
    if (hasStarted && count === end) return;

    // Reset if end value changed
    if (hasStarted && count !== end) {
      setCount(0);
    }

    setHasStarted(true);
    startTimeRef.current = undefined;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

      // Easing function: easeOutExpo for a nice deceleration effect
      const easeOutExpo = 1 - Math.pow(2, -10 * progress);
      const currentCount = Math.floor(easeOutExpo * end);

      setCount(currentCount);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(end); // Ensure we end exactly at the target
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration, startOnMount]);

  return count;
}
