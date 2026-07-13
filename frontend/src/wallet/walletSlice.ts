import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PaydaeState, Persona } from "@/lib/types";
import { performAction } from "@/store/paydaeSlice";
import { connect, exerciseChoice, type WalletAccount } from "./adapter";

export type WalletActionName = "countersign" | "submitInvoice";

export interface PendingSign {
  /** human summary shown in the SignModal, e.g. "Countersign: Designer · $70/h from Paydae Inc." */
  summary: string;
  /** optional second line (amount breakdown etc.) */
  detail: string | null;
  action: WalletActionName;
  /** ledger target: entity + contract + choice argument */
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
  pendingSign: PendingSign | null;
  /** a sign+submit is in flight */
  signing: boolean;
  error: string | null;
}

const initialState: WalletSliceState = {
  status: "disconnected",
  account: null,
  data: null,
  pendingSign: null,
  signing: false,
  error: null,
};

export const connectWallet = createAsyncThunk<WalletAccount, Persona, { rejectValue: string }>(
  "wallet/connect",
  async (persona, { rejectWithValue }) => {
    try {
      return await connect(persona);
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

/** "Sign & submit" in the SignModal: sign through the wallet session, then
 * reuse the existing TxToast by fulfilling the custodial action thunk. */
export const walletExercise = createAsyncThunk<string, Persona, { state: { wallet: WalletSliceState }; rejectValue: string }>(
  "wallet/exercise",
  async (persona, { getState, dispatch, rejectWithValue }) => {
    const { account, pendingSign } = getState().wallet;
    if (!account || !pendingSign) return rejectWithValue("nothing to sign");
    try {
      const updateId = await exerciseChoice(
        account.party,
        pendingSign.entity,
        pendingSign.contractId,
        pendingSign.choice,
        pendingSign.argument,
      );
      // surface the committed tx in the shared TxToast (reads paydae.lastUpdateId)
      dispatch(
        performAction.fulfilled(updateId, `wallet-${pendingSign.action}`, {
          persona,
          action: pendingSign.action,
        }),
      );
      void dispatch(fetchWalletState(persona));
      return updateId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : String(err));
    }
  },
);

const walletSlice = createSlice({
  name: "wallet",
  initialState,
  reducers: {
    requestSign(state, action: PayloadAction<PendingSign>) {
      state.pendingSign = action.payload;
      state.error = null;
    },
    rejectSign(state) {
      state.pendingSign = null;
    },
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
        state.pendingSign = null;
      })
      .addCase(walletExercise.rejected, (state, action) => {
        state.signing = false;
        state.pendingSign = null;
        state.error = action.payload ?? action.error.message ?? "wallet signing failed";
      });
  },
});

export const { requestSign, rejectSign, clearWalletError, disconnectWallet } = walletSlice.actions;
export default walletSlice.reducer;
