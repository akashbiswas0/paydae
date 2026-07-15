import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ActionName, PaydaeState, Role, TxSummary } from "@/lib/types";

/** the wallet identity bound to the current page (no key material — see keystore) */
export interface ActiveProfile {
  fingerprint: string;
  partyId: string;
  role: Role;
  displayName: string;
}

/** a prepared transaction awaiting the user's review + signature */
export interface PendingTx {
  action: ActionName;
  summary: TxSummary;
  preparedTransaction: string;
  preparedTransactionHash: string;
}

interface PaydaeSliceState {
  profile: ActiveProfile | null;
  data: PaydaeState | null;
  /** true while a prepare/execute round-trip is in flight */
  busy: boolean;
  loaded: boolean;
  error: string | null;
  /** transaction prepared on the ledger, shown in the confirm modal */
  pending: PendingTx | null;
  /** Canton transaction id of the last committed action */
  lastUpdateId: string | null;
}

const initialState: PaydaeSliceState = {
  profile: null,
  data: null,
  busy: false,
  loaded: false,
  error: null,
  pending: null,
  lastUpdateId: null,
};

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export const fetchState = createAsyncThunk<PaydaeState, string>(
  "paydae/fetchState",
  (party) => api<PaydaeState>("GET", `/api/state?party=${encodeURIComponent(party)}`),
);

/** Step 1 of a wallet-signed write: the backend prepares the exact transaction
 * and returns its hash + a human-readable summary for the confirm modal. */
export const prepareTx = createAsyncThunk<
  PendingTx,
  { party: string; action: ActionName; payload?: Record<string, unknown> },
  { rejectValue: string }
>("paydae/prepareTx", async ({ party, action, payload }, { rejectWithValue }) => {
  try {
    const res = await api<Omit<PendingTx, "action">>("POST", "/api/tx/prepare", {
      party,
      action,
      payload: payload ?? {},
    });
    return { ...res, action };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : String(err));
  }
});

/** Step 2: the browser signed the hash (see ConfirmModal) — submit the signature. */
export const executeTx = createAsyncThunk<
  string | null,
  { party: string; preparedTransaction: string; signature: string },
  { rejectValue: string }
>("paydae/executeTx", async (body, { dispatch, rejectWithValue }) => {
  try {
    const res = await api<{ updateId?: string | null }>("POST", "/api/tx/execute", body);
    await dispatch(fetchState(body.party));
    return res.updateId ?? null;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : String(err));
  }
});

const paydaeSlice = createSlice({
  name: "paydae",
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<ActiveProfile>) {
      if (state.profile?.partyId !== action.payload.partyId) {
        return { ...initialState, profile: action.payload };
      }
      return state;
    },
    /** user clicked Reject in the confirm modal — nothing was ever submitted */
    rejectPending(state) {
      state.pending = null;
      state.busy = false;
    },
    clearError(state) {
      state.error = null;
    },
    clearUpdateId(state) {
      state.lastUpdateId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchState.fulfilled, (state, action) => {
        // ignore stale responses after a profile switch
        if (state.profile?.partyId !== action.payload.party) return;
        state.loaded = true;
        // keep the old reference when nothing changed so components skip re-rendering
        if (JSON.stringify(state.data) !== JSON.stringify(action.payload)) {
          state.data = action.payload;
        }
      })
      .addCase(prepareTx.pending, (state) => {
        state.busy = true;
        state.error = null;
        state.lastUpdateId = null;
      })
      .addCase(prepareTx.fulfilled, (state, action) => {
        state.busy = false;
        state.pending = action.payload;
      })
      .addCase(prepareTx.rejected, (state, action) => {
        state.busy = false;
        state.error = action.payload ?? action.error.message ?? "prepare failed";
      })
      .addCase(executeTx.pending, (state) => {
        state.busy = true;
      })
      .addCase(executeTx.fulfilled, (state, action) => {
        state.busy = false;
        state.pending = null;
        state.lastUpdateId = action.payload;
      })
      .addCase(executeTx.rejected, (state, action) => {
        state.busy = false;
        state.pending = null;
        state.error = action.payload ?? action.error.message ?? "execute failed";
      });
  },
});

export const { setProfile, rejectPending, clearError, clearUpdateId } = paydaeSlice.actions;
export default paydaeSlice.reducer;
