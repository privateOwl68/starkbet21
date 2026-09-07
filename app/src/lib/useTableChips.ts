import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTableStack } from "./gameContract";
import { useWallet } from "./WalletContext";

/** Live on-chain table chips for the connected wallet (any screen). */
export function useTableChips(pollMs = 20_000) {
  const { address, deployment, isDemo } = useWallet();
  const [stack, setStack] = useState(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stackRef = useRef(0n);

  const syncStack = useCallback((next: bigint) => {
    if (stackRef.current === next) return;
    stackRef.current = next;
    setStack(next);
  }, []);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!address || isDemo) {
        syncStack(0n);
        setError(null);
        return 0n;
      }
      const silent = opts?.silent ?? false;
      if (!silent) setLoading(true);
      try {
        const next = await fetchTableStack(address, deployment);
        syncStack(next);
        setError(null);
        return next;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return stackRef.current;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [address, deployment, isDemo, syncStack],
  );

  useEffect(() => {
    void refresh({ silent: false });
    if (!address || isDemo) return;
    const id = window.setInterval(() => void refresh({ silent: true }), pollMs);
    const onFocus = () => void refresh({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [address, isDemo, pollMs, refresh]);

  return { stack, loading, error, refresh, syncStack };
}
