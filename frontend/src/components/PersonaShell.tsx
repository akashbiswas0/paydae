"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchState, setPersona } from "@/store/paydaeSlice";
import { PERSONAS, type Persona } from "@/lib/types";
import { ErrorToast } from "./ErrorToast";

const POLL_MS = 2500;

export function PersonaShell({
  persona,
  children,
}: {
  persona: Persona;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const loaded = useAppSelector((s) => s.paydae.loaded);
  const meta = PERSONAS[persona];

  useEffect(() => {
    dispatch(setPersona(persona));
    dispatch(fetchState(persona));
    const timer = setInterval(() => dispatch(fetchState(persona)), POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch, persona]);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-20 pt-6">
      <header className="mb-7 flex items-center justify-between">
        <div className="text-2xl font-extrabold tracking-tight">
          Paydae
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            private payroll on Canton
          </span>
        </div>
        <div
          className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-base font-extrabold tracking-wide ${meta.badgeClass}`}
        >
          <span className="size-2.5 rounded-full bg-zinc-950/50" />
          {meta.label}
        </div>
      </header>
      {loaded ? (
        children
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading ledger state…
        </p>
      )}
      <ErrorToast />
    </div>
  );
}
