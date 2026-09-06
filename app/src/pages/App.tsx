import { useState } from "react";
import { AppShell, type AppScreen } from "../components/AppShell";
import { ChainTablePage } from "./ChainTablePage";
import { LobbyPage } from "./LobbyPage";
import { ProfilePage } from "./ProfilePage";
import { TablePage } from "./TablePage";
import { WagerWarPage } from "./WagerWarPage";

type PlayMode = "local" | "localnet";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("lobby");
  const [playMode, setPlayMode] = useState<PlayMode>("localnet");
  const [chips, setChips] = useState(0);
  const [pot, setPot] = useState(0);

  const enterTable = (mode: PlayMode) => {
    setPlayMode(mode);
    setScreen("table");
  };

  return (
    <AppShell
      screen={screen}
      onNavigate={setScreen}
      chips={chips}
      pot={pot}
    >
      {screen === "lobby" && <LobbyPage onEnterTable={enterTable} />}
      {screen === "profile" && (
        <ProfilePage bankroll={chips} onPlay={() => setScreen("table")} />
      )}
      {screen === "war" && <WagerWarPage />}
      {screen === "table" &&
        (playMode === "localnet" ? (
          <ChainTablePage
            onOpenWar={() => setScreen("war")}
            onStackChange={(stack, bet) => {
              setChips(stack);
              setPot(bet);
            }}
            compactChrome
          />
        ) : (
          <TablePage
            onOpenWar={() => setScreen("war")}
            onStackChange={(stack, bet) => {
              setChips(stack);
              setPot(bet);
            }}
            compactChrome
          />
        ))}
    </AppShell>
  );
}
