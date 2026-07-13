import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PaydaeState, Persona } from "@/lib/types";
import { performAction } from "@/store/paydaeSlice";
import { ccBalance, connect, exerciseChoice, onSessionLost, type WalletAccount } from "./adapter";

export type WalletActionName = "countersign" | "submitInvoice";

/** A wallet exercise: reviewed and signed by the user in the GATEWAY's approve
 * popup (opened by the dapp-sdk), not in an in-app modal. */
export interface WalletExerciseInput {
  action: WalletActionName;
  entity: string;
  contractId: string;
  choice: string;
  argument: Record<string, unknown>;
}

interface WalletSliceState {
  status: "disconnected" | "connecting" | "connected";
  account: WalletAccount | null;
  /** contractor state read as the wallet party (overrides the custodial view) */
  data: PaydaeState | null;
  /** real Canton Coin (Amulet) balance of the wallet party, if known */
  ccBalance: number | null;
  /** an exercise is awaiting approval in the gateway popup / in flight */
  signing: boolean;
  error: string | null;
}

const initialState: WalletSliceState = {
  status: "disconnected",
  account: null,
  data: null,
  ccBalance: null,
  signing: false,
  error: null,
};

export const connectWallet = createAsyncThunk<WalletAccount, Persona, { rejectValue: string }>(
  "wallet/connect",
  async (persona, { dispatch, rejectWithValue }) => {
    try {
      const account = await connect(persona);
      onSessionLost(() => dispatch(walletSlice.actions.disconnectWallet()));
      return account;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : String(err));
    }
  },
);

export const fetchWalletState = createAsyncThunk<
  PaydaeState | null,
  Persona,
  { state: { wallet: WalletSliceState } }
>("wallet/fetchState", async (persona, { getState }) => {
  const party = getState().wallet.account?.party;
  if (!party) return null;
  const res = await fetch(`/api/state?p=${persona}&party=${encodeURIComponent(party)}`, {
    cache: "no-store",
  });
  const body = (await res.json()) as PaydaeState & { error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
});

export const fetchCcBalance = createAsyncThunk<
  number | null,
  void,
  { state: { wallet: WalletSliceState } }
>("wallet/fetchCcBalance", async (_, { getState }) => {
  const party = getState().wallet.account?.party;
  if (!party) return null;
  return ccBalance(party);
});

/** Run a wallet exercise: the gateway's approve popup opens for review + key
 * signing; on commit we reuse the existing TxToast via the custodial thunk. */
export const walletExercise = createAsyncThunk<
  string,
  { persona: Persona; input: WalletExerciseInput },
  { state: { wallet: WalletSliceState }; rejectValue: string }
>("wallet/exercise", async ({ persona, input }, { getState, dispatch, rejectWithValue }) => {
  const { account } = getState().wallet;
  if (!account) return rejectWithValue("connect a wallet first");
  try {
    const updateId = await exerciseChoice(
      account.party,
      input.entity,
      input.contractId,
      input.choice,
      input.argument,
    );
    // surface the committed tx in the shared TxToast (reads paydae.lastUpdateId)
    dispatch(
      performAction.fulfilled(updateId, `wallet-${input.action}`, {
        persona,
        action: input.action,
      }),
    );
    void dispatch(fetchWalletState(persona));
    return updateId;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : String(err));
  }
});

const walletSlice = createSlice({
  name: "wallet",
  initialState,
  reducers: {
    clearWalletError(state) {
      state.error = null;
    },
    disconnectWallet() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(connectWallet.pending, (state) => {
        state.status = "connecting";
        state.error = null;
      })
      .addCase(connectWallet.fulfilled, (state, action) => {
        state.status = "connected";
        state.account = action.payload;
      })
      .addCase(connectWallet.rejected, (state, action) => {
        state.status = "disconnected";
        state.error = action.payload ?? action.error.message ?? "wallet connection failed";
      })
      .addCase(fetchCcBalance.fulfilled, (state, action) => {
        if (action.payload !== null) state.ccBalance = action.payload;
      })
      .addCase(fetchWalletState.fulfilled, (state, action) => {
        if (!action.payload) return;
        if (JSON.stringify(state.data) !== JSON.stringify(action.payload)) {
          state.data = action.payload;
        }
      })
      .addCase(walletExercise.pending, (state) => {
        state.signing = true;
        state.error = null;
      })
      .addCase(walletExercise.fulfilled, (state) => {
        state.signing = false;
      })
      .addCase(walletExercise.rejected, (state, action) => {
        state.signing = false;
        state.error = action.payload ?? action.error.message ?? "wallet signing failed";
      });
  },
});

export const { clearWalletError, disconnectWallet } = walletSlice.actions;
export default walletSlice.reducer;
