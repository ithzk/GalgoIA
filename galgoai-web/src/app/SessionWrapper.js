"use client";

import { SessionProvider } from "./auth";

export default function SessionWrapper({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
