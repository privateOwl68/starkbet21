import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createStore } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import {
  Account,
  RpcProvider,
  WalletAccountV6,
  compareVersions,
  walletV6,
  type AccountInterface,
} from "starknet";
import {
  getDeployment,
  isPublicNetwork,
  resolveRpcUrl,
  shortAddress,
  type Deployment,
} from "./deployment";

type WalletState = {
  address: string | null;
  account: AccountInterface | null;
  /** Present when connected via WalletAccountV6 (wallet-standard). */
  strk20Account: WalletAccountV6 | null;
  /** True when wallet reports Wallet API ≥ 0.10.3 (STRK20 methods). */
  strk20Supported: boolean;
  walletName: string | null;
  connecting: boolean;
  pickerOpen: boolean;
  availableWallets: WalletWithStarknetFeatures[];
  error: string | null;
  deployment: Deployment;
  networkLabel: string;
  /** Opens the wallet-standard picker (Ready / Xverse / …). */
  connectWallet: () => void;
  selectWallet: (wallet: WalletWithStarknetFeatures) => Promise<void>;
  closePicker: () => void;
  disconnectWallet: () => Promise<void>;
  useLocalnetDemo: () => void;
  isDemo: boolean;
};

const WalletCtx = createContext<WalletState | null>(null);

function normalizeId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** MetaMask Snap probing spam; Braavos is not STRK20-ready for this flow yet. */
function isPickable(w: WalletWithStarknetFeatures): boolean {
  const id = normalizeId(w.name);
  return !id.includes("metamask");
}

async function walletSupportsStrk20(wallet: WalletWithStarknetFeatures): Promise<boolean> {
  try {
    const versions = await walletV6.supportedWalletApi(wallet);
    return versions.some((v) => compareVersions(v, "0.10.3") >= 0);
  } catch {
    return false;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const deployment = useMemo(() => getDeployment(), []);
  const [address, setAddress] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInterface | null>(null);
  const [strk20Account, setStrk20Account] = useState<WalletAccountV6 | null>(null);
  const [strk20Supported, setStrk20Supported] = useState(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletWithStarknetFeatures[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    // eip1193Adapters: [] avoids MetaMask unlock spam from EIP-6963 Snap probing.
    const store = createStore({ eip1193Adapters: [] });
    const sync = () => setAvailableWallets(store.getWallets().filter(isPickable));
    sync();
    return store.subscribe(() => sync());
  }, []);

  const connectWallet = useCallback(() => {
    setError(null);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    if (!connecting) setPickerOpen(false);
  }, [connecting]);

  const selectWallet = useCallback(
    async (selected: WalletWithStarknetFeatures) => {
      setConnecting(true);
      setError(null);
      try {
        const provider = new RpcProvider({
          nodeUrl: resolveRpcUrl(deployment),
          blockIdentifier: "latest",
        });
        const v6 = await WalletAccountV6.connect(provider, selected);
        const supports = await walletSupportsStrk20(selected);
        setStrk20Account(v6);
        setStrk20Supported(supports);
        setAccount(v6);
        setAddress(v6.address);
        setWalletName(selected.name);
        setIsDemo(false);
        setPickerOpen(false);
        if (!supports) {
          setError(
            `${selected.name} connected for public play, but Wallet API < 0.10.3 — install Ready (ready.co) for private buy-in`,
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setAccount(null);
        setStrk20Account(null);
        setStrk20Supported(false);
        setAddress(null);
        setWalletName(null);
      } finally {
        setConnecting(false);
      }
    },
    [deployment],
  );

  const disconnectWallet = useCallback(async () => {
    setAccount(null);
    setStrk20Account(null);
    setStrk20Supported(false);
    setAddress(null);
    setWalletName(null);
    setIsDemo(false);
    setError(null);
    setPickerOpen(false);
  }, []);

  const useLocalnetDemo = useCallback(() => {
    if (isPublicNetwork(deployment)) {
      setError("Demo key is disabled on Sepolia/mainnet — connect a wallet");
      return;
    }
    const addr = deployment.accountAddress;
    const pk = deployment.accountPrivateKey;
    if (!addr || !pk) {
      setError("Localnet deployment missing demo account — run deploy_local.sh");
      return;
    }
    const provider = new RpcProvider({
      nodeUrl: resolveRpcUrl(deployment),
      blockIdentifier: "latest",
    });
    const demo = new Account({
      provider,
      address: addr,
      signer: pk,
    });
    setAccount(demo);
    setStrk20Account(null);
    setStrk20Supported(false);
    setAddress(addr);
    setWalletName("Localnet demo");
    setIsDemo(true);
    setError(null);
  }, [deployment]);

  const value: WalletState = {
    address,
    account,
    strk20Account,
    strk20Supported,
    walletName,
    connecting,
    pickerOpen,
    availableWallets,
    error,
    deployment,
    networkLabel: deployment.network || "localnet",
    connectWallet,
    selectWallet,
    closePicker,
    disconnectWallet,
    useLocalnetDemo,
    isDemo,
  };

  return (
    <WalletCtx.Provider value={value}>
      {children}
      {pickerOpen && <WalletPicker />}
    </WalletCtx.Provider>
  );
}

function WalletPicker() {
  const { availableWallets, connecting, selectWallet, closePicker, error } = useWallet();

  return (
    <div className="wallet-picker-overlay" role="presentation" onClick={closePicker}>
      <div
        className="wallet-picker glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="wallet-picker__head">
          <h2 id="wallet-picker-title">Connect a wallet</h2>
          <button type="button" className="wallet-picker__close" onClick={closePicker} disabled={connecting}>
            ×
          </button>
        </header>
        <p className="wallet-picker__hint">
          Private buy-in needs <strong>Ready</strong> (Wallet API ≥ 0.10.3). Other Starknet wallets still work for
          public table play.
        </p>
        {availableWallets.length ? (
          <ul className="wallet-picker__list">
            {availableWallets.map((w) => (
              <li key={w.name}>
                <button
                  type="button"
                  className="wallet-picker__row"
                  disabled={connecting}
                  onClick={() => void selectWallet(w)}
                >
                  {typeof w.icon === "string" && w.icon ? (
                    <img src={w.icon} alt="" width={28} height={28} />
                  ) : (
                    <span className="wallet-picker__glyph" aria-hidden />
                  )}
                  <span>{w.name}</span>
                  <span className="wallet-picker__go">{connecting ? "…" : "→"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wallet-picker__empty">
            No Starknet wallet detected. Install{" "}
            <a href="https://www.ready.co/" target="_blank" rel="noreferrer">
              Ready
            </a>{" "}
            or{" "}
            <a href="https://www.xverse.app/" target="_blank" rel="noreferrer">
              Xverse
            </a>
            , then refresh.
          </p>
        )}
        {error && (
          <p className="wallet-picker__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export { shortAddress };
