// src/app/layout.js
import "./globals.css";
import SessionWrapper from "./SessionWrapper";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata = {
  title: "GalgoAI Chat",
  description: "Asistente virtual para estudiantes del Instituto Tecnológico de Tijuana",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <style>{`@font-face{font-family:"PixelDigivolve";src:url("${BASE}/fonts/pixel_digivolve.otf") format("opentype");font-weight:normal;font-style:normal;font-display:swap;}`}</style>
      </head>
      <body>
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
