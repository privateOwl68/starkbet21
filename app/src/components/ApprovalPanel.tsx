import { useCallback, useEffect, useState } from "react";
import { useWallet } from "../lib/WalletContext";
import {
  createGameClient,
  createRelayerAccount,
  resolveTableRelayer,
  type GameClient,
} from "../lib/gameContract";
import { formatWeiAsStrk, parseStrkToWei } from "../lib/strk20";
import { deployScriptHint, networkDisplayName, shortAddress } from "../lib/deployment";

type Props = {
  onChanged?: () => void;
  compact?: boolean;
};

function sameAddr(a: string, b: string) {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

function friendlyError(e: unknown, network?: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Entry point .* not found|deposit_strk|set_operator/i.test(msg)) {
    const net = networkDisplayName(network);
    const script = deployScriptHint(network);
    return `This game contract is outdated — redeploy ${net} (${script}) so Approve can mint chips from STRK.`;
  }
  if (/vault unset|strk_token/i.test(msg)) {
    return "STRK vault not linked on this game — redeploy with STRK_TOKEN set.";
  }
  if (/transfer_from|insufficient|allowance/i.test(msg)) {
    return "STRK transfer failed — check wallet STRK balance and try Approve + deposit again.";
  }
  return msg;
}

export function ApprovalPanel({ onChanged, compact = false }: Props) {
  const { account, address, deployment, connectWallet, connecting, isDemo } = useWallet();
  const [amountStrk, setAmountStrk] = useState("1");
  const [operator, setOperator] = useState<string>("");
  const [authorized, setAuthorized] = useState(false);
  const [relayReady, setRelayReady] = useState(false);
  const [depositReady, setDepositReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account || !address) {
      setAuthorized(false);
      setOperator("");
      setDepositReady(false);
      return;
    }
    try {
      const client = createGameClient({ account, playerAddress: address, deployment });
      const canDeposit = await client.supportsChipDeposit();
      setDepositReady((prev) => (prev === canDeposit ? prev : canDeposit));
      const [op, def] = await Promise.all([client.getOperator(), client.getDefaultRelayer()]);
      const preferred = resolveTableRelayer(deployment) || def;
      const show =
        preferred && preferred !== "0x0"
          ? preferred
          : op && op !== "0x0"
            ? op
            : "";
      setOperator((prev) => (prev === show ? prev : show));
      const isAuth = Boolean(op && op !== "0x0");
      setAuthorized((prev) => (prev === isAuth ? prev : isAuth));
      const relayerAcct = createRelayerAccount(deployment);
      const ready = Boolean(relayerAcct && op && op !== "0x0" && sameAddr(op, relayerAcct.address));
      setRelayReady((prev) => (prev === ready ? prev : ready));
    } catch {
      setDepositReady(false);
    }
  }, [account, address, deployment]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const withClient = async (fn: (c: GameClient) => Promise<void>) => {
    if (!account || !address) {
      setError("Connect your wallet first");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const client = createGameClient({ account, playerAddress: address, deployment });
      await fn(client);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(friendlyError(e, deployment.network));
    } finally {
      setBusy(false);
    }
  };

  const onApproveDeposit = async () => {
    const wei = parseStrkToWei(amountStrk);
    await withClient(async (c) => {
      if (!(await c.supportsChipDeposit())) {
        throw new Error("vault unset");
      }
      setStatus("Approving STRK and minting table chips…");
      await c.approveAndDepositStrk(wei);
      setStatus(`Minted ${formatWeiAsStrk(wei, 3)} STRK as table chips (1 chip = 1 STRK)`);
    });
  };

  const onAuthorize = async () => {
    const relayerAcct = createRelayerAccount(deployment);
    const target =
      relayerAcct?.address ||
      resolveTableRelayer(deployment) ||
      deployment.tableRelayer;
    if (!target || target === "0x0") {
      setError(
        "Relayer key not loaded. Add VITE_RELAYER_ADDRESS + VITE_RELAYER_PRIVATE_KEY to app/.env.local and restart npm run dev.",
      );
      return;
    }
    if (!createRelayerAccount(deployment)) {
      setError(
        "Relayer private key missing — gasless play needs VITE_RELAYER_PRIVATE_KEY in app/.env.local (restart Vite after saving).",
      );
      return;
    }
    await withClient(async (c) => {
      setStatus("One wallet signature: authorize house relayer…");
      await c.setOperator(target);
      setStatus("Done — Deal / Hit / Stand will submit via relayer (no more wallet popups)");
    });
  };

  const onRevoke = async () => {
    await withClient(async (c) => {
      setStatus("Revoking relayer…");
      await c.clearOperator();
      setStatus("Relayer cleared — you will sign each table action again");
    });
  };

  return (
    <section className={`approval-panel${compact ? " approval-panel--compact" : ""}`}>
      <header className="approval-panel__head">
        <h2>Pre-approve chips</h2>
        <p>
          Pull public STRK into the game and mint table chips (1 chip = 1 STRK). Then authorize the house
          relayer so hit/stand no longer need a wallet popup. Relayer cannot cash out.
        </p>
      </header>

      {!address && (
        <button type="button" className="btn btn--hit" disabled={connecting} onClick={() => void connectWallet()}>
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      )}

      {address && (
        <>
          <div className="approval-panel__status" aria-live="polite">
            <span>
              Relayer: <code>{operator && operator !== "0x0" ? shortAddress(operator) : "not set"}</code>
            </span>
            <span className={depositReady ? "is-on" : "is-off"}>
              {depositReady ? "STRK → chips ready" : "Vault not ready"}
            </span>
            <span className={authorized ? "is-on" : "is-off"}>
              {authorized
                ? relayReady
                  ? "Authorized · in-app relay ready"
                  : "Authorized · awaiting relayer key"
                : "Not authorized"}
            </span>
          </div>

          {!isDemo && (
            <>
              <label className="privacy-panel__field">
                Chip amount (STRK)
                <input
                  value={amountStrk}
                  onChange={(e) => setAmountStrk(e.target.value)}
                  inputMode="decimal"
                  disabled={busy}
                />
              </label>
              <div className="privacy-panel__presets" role="group" aria-label="Chip presets">
                {["1", "10", "25", "50"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="chips__quick-btn"
                    disabled={busy}
                    onClick={() => setAmountStrk(p)}
                  >
                    {p} chips
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="approval-panel__actions">
            {!isDemo && (
              <button
                type="button"
                className="btn btn--gold"
                disabled={busy || !depositReady}
                onClick={() => void onApproveDeposit()}
                title="ERC-20 approve + deposit_strk → table chips"
              >
                {busy ? "Working…" : "Approve + mint chips"}
              </button>
            )}
            <button type="button" className="btn btn--hit" disabled={busy || isDemo} onClick={() => void onAuthorize()}>
              {authorized && relayReady ? "Re-authorize relayer" : "Enable gasless play"}
            </button>
            <button type="button" className="btn ghost" disabled={busy || !authorized} onClick={() => void onRevoke()}>
              Revoke
            </button>
          </div>

          {!depositReady && !isDemo && (
            <p className="approval-panel__hint">
              Hard-refresh after redeploy. New game: <code>{shortAddress(deployment.blackjackGame)}</code>
            </p>
          )}
          {isDemo && (
            <p className="approval-panel__hint">Switch off demo account and connect Ready to mint chips from STRK.</p>
          )}
          {status && <p className="privacy-panel__status">{status}</p>}
          {error && (
            <p className="privacy-panel__error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
