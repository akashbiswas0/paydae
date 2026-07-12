import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ActionName, PaydaeState, Persona } from "@/lib/types";

interface PaydaeSliceState {
  persona: Persona | null;
  data: PaydaeState | null;
  /** true while an action (ledger write) is in flight */
  busy: boolean;
  /** initial load finished */
  loaded: boolean;
  error: string | null;
}

const initialState: PaydaeSliceState = {
  persona: null,
  data: null,
  busy: false,
  loaded: false,
  error: null,
};

export const fetchState = createAsyncThunk<PaydaeState, Persona>(
  "paydae/fetchState",
  async (persona) => {
    const res = await fetch(`/api/state?p=${persona}`, { cache: "no-store" });
    const body = (await res.json()) as PaydaeState & { error?: string };
    if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body;
  },
);

export const performAction = createAsyncThunk<
  void,
  { persona: Persona; action: ActionName; payload?: Record<string, unknown> },
  { rejectValue: string }
>("paydae/performAction", async ({ persona, action, payload }, { dispatch, rejectWithValue }) => {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p: persona, action, payload: payload ?? {} }),
  });
  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || body.error) return rejectWithValue(body.error ?? `HTTP ${res.status}`);
  await dispatch(fetchState(persona));
});

const paydaeSlice = createSlice({
  name: "paydae",
  initialState,
  reducers: {
    setPersona(state, action: PayloadAction<Persona>) {
      if (state.persona !== action.payload) {
        return { ...initialState, persona: action.payload };
      }
      return state;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchState.fulfilled, (state, action) => {
        // ignore stale responses after a persona switch
        if (state.persona !== action.payload.persona) return;
        state.loaded = true;
        // keep the old reference when nothing changed so components skip re-rendering
        if (JSON.stringify(state.data) !== JSON.stringify(action.payload)) {
          state.data = action.payload;
        }
      })
      .addCase(performAction.pending, (state) => {
        state.busy = true;
        state.error = null;
      })
      .addCase(performAction.fulfilled, (state) => {
        state.busy = false;
      })
      .addCase(performAction.rejected, (state, action) => {
        state.busy = false;
        state.error = action.payload ?? action.error.message ?? "action failed";
      });
  },
});

export const { setPersona, clearError } = paydaeSlice.actions;
export default paydaeSlice.reducer;
