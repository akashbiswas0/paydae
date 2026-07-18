"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearError } from "@/store/paydaeSlice";

export function ErrorToast() {
  const error = useAppSelector((s) => s.paydae.error);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => dispatch(clearError()), 5000);
    return () => clearTimeout(timer);
  }, [error, dispatch]);

  if (!error) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 shadow-lg">
      Ledger error: {error}
    </div>
  );
}
