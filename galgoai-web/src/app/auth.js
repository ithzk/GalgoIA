"use client";

// Autenticación 100% cliente (compatible con GitHub Pages).
// Flujo: Google Identity Services -> credential (ID token) -> POST /auth al backend
// -> el backend valida el dominio institucional y devuelve un token de sesión propio.
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const STORAGE_KEY = "galgoai_session";

export const asset = (path) => `${BASE_PATH}${path}`;

function readStored() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (s && s.token && s.expires > Date.now()) return s;
  } catch {}
  return null;
}

let currentToken = null;

// fetch con el token de sesión. Si el backend responde 401, cierra sesión.
export async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    currentToken = null;
    window.dispatchEvent(new Event("galgoai-logout"));
  }
  return res;
}

const AuthContext = createContext({ data: null, status: "loading" });

export function SessionProvider({ children }) {
  const [state, setState] = useState({ data: null, status: "loading" });

  useEffect(() => {
    const apply = (s) => {
      currentToken = s ? s.token : null;
      setState(
        s
          ? { data: { user: s.user, expires: s.expires }, status: "authenticated" }
          : { data: null, status: "unauthenticated" },
      );
    };
    apply(readStored());
    const onLogout = () => apply(null);
    const onLogin = () => apply(readStored());
    window.addEventListener("galgoai-logout", onLogout);
    window.addEventListener("galgoai-login", onLogin);
    return () => {
      window.removeEventListener("galgoai-logout", onLogout);
      window.removeEventListener("galgoai-login", onLogin);
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useSession = () => useContext(AuthContext);

export function signOut() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("last_session");
  window.dispatchEvent(new Event("galgoai-logout"));
}

// Botón oficial de Google. Al recibir el credential lo intercambia por la sesión.
export function GoogleSignInButton() {
  const ref = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        hd: "tectijuana.edu.mx",
        callback: async ({ credential }) => {
          try {
            const res = await fetch(`${API_URL}/auth`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential }),
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.error || "No se pudo iniciar sesión");
              return;
            }
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ token: data.token, user: data.user, expires: data.expires }),
            );
            window.dispatchEvent(new Event("galgoai-login"));
          } catch {
            setError("No se pudo conectar con el servidor");
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "filled_blue",
        size: "large",
        text: "signin_with",
        shape: "pill",
      });
    };

    if (window.google) {
      init();
    } else {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = init;
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={ref} />
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
