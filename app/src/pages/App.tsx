import { useCallback, useEffect, useState } from "react";
import { AppShell, type AppScreen } from "../components/AppShell";
import { useTableChips } from "../lib/useTableChips";
import { ChainTablePage } from "./ChainTablePage";
import { LobbyPage } from "./LobbyPage";
import { WagerWarPage } from "./WagerWarPage";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("lobby");
  const [pot, setPot] = useState<number | bigint>(0);
  const { stack: chainChips, refresh: refreshChainChips, syncStack } = useTableChips();

  const enterTable = () => {
    setScreen("table");
    void refreshChainChips({ silent: true });
  };

  const onChainStackChange = useCallback(
    (stack: bigint, bet: bigint) => {
      syncStack(stack);
      setPot(bet);
    },
    [syncStack],
  );

  useEffect(() => {
    void refreshChainChips({ silent: true });
  }, [refreshChainChips]);

  return (
    <AppShell
      screen={screen}
      onNavigate={(s) => {
        setScreen(s);
        if (s === "lobby") void refreshChainChips({ silent: true });
      }}
      chips={chainChips}
      pot={pot}
    >
      {screen === "lobby" && (
        <LobbyPage
          onEnterTable={enterTable}
          tableStack={chainChips}
          onStackRefresh={() => void refreshChainChips({ silent: false })}
        />
      )}
      {screen === "war" && <WagerWarPage />}
      {screen === "table" && (
        <ChainTablePage
          onOpenWar={() => setScreen("war")}
          onStackChange={onChainStackChange}
          compactChrome
        />
      )}
    </AppShell>
  );
}
