import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Defaults to reduced until the native preference resolves, preventing a flash of motion. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
