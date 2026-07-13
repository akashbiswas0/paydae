// Canton Wallet Gateway adapter — the contractor-side signing path.
//
// Ported from the pattern in Digital Asset's canton-network-quickstart
// (via https://github.com/akashbiswas0/canton-start, frontend/src/ledger/adapter.ts):
// the browser talks CIP-103 to the gateway through @canton-network/dapp-sdk.
//
//   connect()          -> SDK wallet picker + gateway login popup
//   exerciseChoice()   -> prepareExecuteAndWait: the GATEWAY's approve popup is
//                         where the user reviews and signs (wallet-kernel key),
//                         then the gateway submits via interactive submission
//   ccBalance()        -> authenticated ledgerApi passthrough (Token Standard
//                         Holding interface views)
//
// dapp-sdk is imported dynamically so it only ever loads in the browser
// (client components), never during SSR/build.

import { GATEWAY_URLS, NETWORK_ID, templateId } from "./config";

export interface WalletAccount {
  party: string;
  label: string;
  /** party namespace fingerprint (the wallet's key namespace) */
  namespace: string;
}

type DappSdk = typeof import("@canton-network/dapp-sdk");

interface GatewayWallet {
  partyId: string;
  hint?: string;
  namespace?: string;
  primary?: boolean;
  disabled?: boolean;
  status?: string;
  networkId?: string;
}

let dappModule: DappSdk | null = null;
let initialized: Promise<void> | null = null;
let initializedGateway: string | null = null;
let sessionLostListener: (() => void) | null = null;
let lifecycleHooked = false;

async function sdk(): Promise<DappSdk> {
  dappModule ??= await import("@canton-network/dapp-sdk");
  return dappModule;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  const text = String(err);
  return text === "[object Object]" ? "wallet request failed" : text;
}

async function assertGatewayAvailable(gatewayUrl: string): Promise<void> {
  try {
    // any HTTP status proves the gateway is reachable (GET on the JSON-RPC
    // endpoint returns 400; an explicit OPTIONS fetch would fail preflight)
    await fetch(`${gatewayUrl}/api/v0/dapp`, { method: "GET" });
  } catch (err) {
    throw new Error(
      `Canton Wallet Gateway is unavailable at ${gatewayUrl}. Start it with: cd wallet && npm run devnet (${messageOf(err)})`,
    );
  }
}

function initialize(gatewayUrl: string): Promise<void> {
  if (initialized && initializedGateway === gatewayUrl) return initialized;
  if (initialized && initializedGateway !== gatewayUrl) {
    // dapp-sdk is a singleton per page; each persona page uses one gateway.
    return Promise.reject(
      new Error(`wallet already initialized for ${initializedGateway}; reload the page`),
    );
  }
  initializedGateway = gatewayUrl;
  initialized = sdk()
    .then(async (dapp) => {
      const adapters = [
        new dapp.RemoteAdapter({
          name: "Paydae Wallet Gateway",
          rpcUrl: `${gatewayUrl}/api/v0/dapp`,
        }),
      ];
      await dapp.init({ defaultAdapters: adapters });
    })
    .catch((err) => {
      initialized = null;
      initializedGateway = null;
      throw err;
    });
  return initialized;
}

async function hookLifecycle(): Promise<void> {
  if (lifecycleHooked) return;
  const dapp = await sdk();
  await dapp.onStatusChanged((status) => {
    const s = status as { connection?: { isConnected?: boolean; isNetworkConnected?: boolean } };
    if (!s.connection?.isConnected || !s.connection?.isNetworkConnected) {
      sessionLostListener?.();
    }
  });
  lifecycleHooked = true;
}

export function onSessionLost(listener: () => void): void {
  sessionLostListener = listener;
}

function selectWallet(wallets: GatewayWallet[]): GatewayWallet | undefined {
  const usable = wallets.filter(
    (w) =>
      !w.disabled &&
      w.status !== "removed" &&
      (!w.networkId || w.networkId === NETWORK_ID) &&
      w.partyId,
  );
  return usable.find((w) => w.primary) ?? usable[0];
}

function toAccount(wallet: GatewayWallet): WalletAccount {
  return {
    party: wallet.partyId,
    label: wallet.hint || "Canton wallet",
    namespace: wallet.namespace ?? wallet.partyId.split("::")[1] ?? "",
  };
}

/**
 * Connect the persona's wallet: opens the SDK wallet picker and the gateway's
 * login popup, then selects the gateway session's primary wallet. Wallets are
 * created manually in the gateway web UI beforehand (Wallets page).
 */
export async function connect(persona: string): Promise<WalletAccount> {
  const gatewayUrl = GATEWAY_URLS[persona];
  if (!gatewayUrl) throw new Error(`persona "${persona}" has no wallet gateway`);
  try {
    await assertGatewayAvailable(gatewayUrl);
    await initialize(gatewayUrl);
    const dapp = await sdk();
    const result = await dapp.connect();
    if (!result.isConnected || !result.isNetworkConnected) {
      throw new Error(
        (result as { networkReason?: string; reason?: string }).networkReason ??
          (result as { reason?: string }).reason ??
          "Wallet connection was not completed.",
      );
    }
    await hookLifecycle();
    const wallets = (await dapp.listAccounts()) as GatewayWallet[];
    const wallet = selectWallet(Array.isArray(wallets) ? wallets : [wallets]);
    if (!wallet) {
      throw new Error(
        `No wallet on this gateway yet. Open ${gatewayUrl}, log into the "Wallet Onboarding" network and create one (Wallets page), then reconnect.`,
      );
    }
    return toAccount(wallet);
  } catch (err) {
    throw new Error(messageOf(err) || "Wallet connection was not completed. Allow popups for this site and try again.");
  }
}

export async function disconnect(): Promise<void> {
  if (!initialized) return;
  const dapp = await sdk();
  await dapp.disconnect().catch(() => null);
}

/**
 * Exercise a choice as the wallet party. prepareExecuteAndWait opens the
 * gateway's approve popup — the user reviews the transaction there and the
 * wallet key signs it. Resolves with the committed updateId.
 */
export async function exerciseChoice(
  party: string,
  entity: string,
  contractId: string,
  choice: string,
  argument: Record<string, unknown>,
): Promise<string> {
  const dapp = await sdk();
  let result;
  try {
    result = await dapp.prepareExecuteAndWait({
      commands: [
        {
          ExerciseCommand: {
            templateId: templateId(entity),
            contractId,
            choice,
            choiceArgument: argument,
          },
        },
      ],
      commandId: `paydae-wallet-${crypto.randomUUID()}`,
      actAs: [party],
    });
  } catch (err) {
    throw new Error(messageOf(err) || "The wallet rejected or failed to process the transaction.");
  }
  const updateId = (result as { tx?: { payload?: { updateId?: string } } })?.tx?.payload?.updateId;
  if (!updateId) throw new Error("wallet submitted but returned no updateId");
  return updateId;
}

const HOLDING_INTERFACE_ID =
  "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding";

interface AcsRow {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: { interfaceViews?: { viewValue?: { amount?: string; lock?: unknown } }[] };
    };
  };
}

/** Real Canton Coin (Amulet) balance of a party, read through the gateway's
 * authenticated ledger passthrough as unlocked Token Standard holdings. */
export async function ccBalance(party: string): Promise<number> {
  const dapp = await sdk();
  const end = (await dapp.ledgerApi({
    requestMethod: "get",
    resource: "/v2/state/ledger-end",
  })) as { offset: number };
  const rows = (await dapp.ledgerApi({
    requestMethod: "post",
    resource: "/v2/state/active-contracts",
    body: {
      activeAtOffset: end.offset,
      verbose: false,
      filter: {
        filtersByParty: {
          [party]: {
            cumulative: [
              {
                identifierFilter: {
                  InterfaceFilter: {
                    value: {
                      interfaceId: HOLDING_INTERFACE_ID,
                      includeInterfaceView: true,
                      includeCreatedEventBlob: false,
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
  })) as AcsRow[] | null;
  let total = 0;
  for (const row of rows ?? []) {
    for (const view of row.contractEntry?.JsActiveContract?.createdEvent?.interfaceViews ?? []) {
      const amount = Number(view.viewValue?.amount);
      if (Number.isFinite(amount) && !view.viewValue?.lock) total += amount;
    }
  }
  return total;
}
