import { configureStore } from "@reduxjs/toolkit";
import paydaeReducer from "./paydaeSlice";
// wallet-integration: register the wallet reducer (inert unless NEXT_PUBLIC_WALLET_MODE=1)
import walletReducer from "@/wallet/walletSlice";

export const makeStore = () =>
  configureStore({
    reducer: { paydae: paydaeReducer, wallet: walletReducer },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
