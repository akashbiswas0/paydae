// Canton Wallet Gateway adapter — the contractor-side signing path.
//
// Speaks the gateway's JSON-RPC wallet-session protocol directly (the same
// protocol @canton-network/dapp-sdk's RemoteAdapter uses under the hood):
//   dApp API  (/api/v0/dapp): prepareExecute — builds + stores the prepared tx
//   user API  (/api/v0/user): addSession / listWallets / sign / execute
// Every exercise is prepared by the gateway, signed with the wallet's ed25519
// key, and submitted via Canton interactive submission — the custodial backend
// is never involved.

import { GATEWAY_URL, NETWORK_ID, ONBOARD_USER, SUBMIT_USER, WALLET_HINTS, templateId } from "./config";
import { selfSignedJwt } from "./jwt";

export interface WalletAccount {
  party: string;
  label: string;
  /** party namespace fingerprint (the wallet's key namespace) */
  namespace: string;
}

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface GatewayWallet {
  partyId: string;
  hint?: string;
  namespace?: string;
  primary?: boolean;
  status?: string;
}

let rpcId = 0;

async function rpc<T>(
  apiPath: "/api/v0/dapp" | "/api/v0/user",
  sub: string,
  method: string,
  params: unknown,
): Promise<T> {
  const jwt = await selfSignedJwt(sub);
  let resp: Response;
  try {
    resp = await fetch(`${GATEWAY_URL}${apiPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    });
  } catch {
    throw new Error(
      `Wallet Gateway unreachable at ${GATEWAY_URL}. Start it with: cd wallet && npm run devnet`,
    );
  }
  const body = (await resp.json()) as { result?: T; error?: RpcError };
  if (body.error) {
    const detail =
      typeof body.error.data === "object" && body.error.data !== null
        ? (body.error.data as { cause?: string }).cause
        : undefined;
    throw new Error(detail ?? body.error.message ?? `wallet ${method} failed`);
  }
  return body.result as T;
}

const user = <T>(sub: string, method: string, params: unknown) =>
  rpc<T>("/api/v0/user", sub, method, params);
const dapp = <T>(method: string, params: unknown) =>
  rpc<T>("/api/v0/dapp", SUBMIT_USER, method, params);

let sessionsReady: Promise<void> | null = null;

/** Ensure gateway sessions exist for both gateway users (idempotent). */
function ensureSessions(): Promise<void> {
  sessionsReady ??= (async () => {
    await user(SUBMIT_USER, "addSession", { networkId: NETWORK_ID });
    await user(ONBOARD_USER, "addSession", { networkId: NETWORK_ID });
  })().catch((err) => {
    sessionsReady = null;
    throw err;
  });
  return sessionsReady;
}

/**
 * Connect the persona's wallet: attach to the gateway session and select the
 * pre-onboarded wallet for this contractor (wallet/onboard.mjs).
 */
export async function connect(persona: string): Promise<WalletAccount> {
  const hint = WALLET_HINTS[persona];
  if (!hint) throw new Error(`persona "${persona}" has no wallet`);
  await ensureSessions();
  const wallets = await user<GatewayWallet[]>(ONBOARD_USER, "listWallets", {});
  const wallet = wallets.find((w) => w.hint === hint && w.status === "allocated");
  if (!wallet) {
    throw new Error(`No onboarded wallet "${hint}" on the gateway. Run: cd wallet && node onboard.mjs`);
  }
  return {
    party: wallet.partyId,
    label: hint,
    namespace: wallet.namespace ?? wallet.partyId.split("::")[1] ?? "",
  };
}

interface SignResult {
  status: string;
  signature?: string;
  signedBy?: string;
}

/**
 * Exercise a choice as the wallet party: gateway prepares the transaction,
 * the wallet key signs its hash, and the gateway submits it via Canton
 * interactive submission. Returns the committed updateId.
 */
export async function exerciseChoice(
  party: string,
  entity: string,
  contractId: string,
  choice: string,
  argument: Record<string, unknown>,
): Promise<string> {
  await ensureSessions();
  const prep = await dapp<{ userUrl: string }>("prepareExecute", {
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
  const transactionId = new URL(prep.userUrl).searchParams.get("transactionId");
  if (!transactionId) throw new Error("gateway returned no transactionId");

  const signed = await user<SignResult>(SUBMIT_USER, "sign", { transactionId, partyId: party });
  if (signed.status !== "signed" || !signed.signature || !signed.signedBy) {
    throw new Error(`wallet did not sign the transaction (status: ${signed.status})`);
  }

  const executed = await user<{ updateId?: string }>(SUBMIT_USER, "execute", {
    transactionId,
    partyId: party,
    signature: signed.signature,
    signedBy: signed.signedBy,
  });
  if (!executed?.updateId) throw new Error("gateway submitted but returned no updateId");
  return executed.updateId;
}
