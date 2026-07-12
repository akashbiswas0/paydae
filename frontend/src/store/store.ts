import { configureStore } from "@reduxjs/toolkit";
import paydaeReducer from "./paydaeSlice";

export const makeStore = () =>
  configureStore({
    reducer: { paydae: paydaeReducer },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
