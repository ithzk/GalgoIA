// File: src/app/page.js
"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useSession, signOut, apiFetch, asset, GoogleSignInButton } from "./auth";

export default function Home() {
  const { data: session, status } = useSession();
  const loadingSession = status === "loading";

  const [historyData, setHistoryData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [messages, setMessages] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuSessionId, setMenuSessionId] = useState(null);
  const [customTitles, setCustomTitles] = useState({});
  const [editingSessionId, setEditingSessionId] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  function obtenerFechaLegible(id) {
    if (!id) return "Sin fecha";
    const parte = id.split("_").pop();
    const millis = parseInt(parte, 10);
    const fecha = new Date(isNaN(millis) ? parte : millis);
    return isNaN(fecha) ? "Sin fecha" : fecha.toLocaleDateString();
  }

  // Cargar historial al autenticarse
  useEffect(() => {
    if (status !== "authenticated") return;
    apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/historial?email=${session.user.email}`,
    )
      .then((res) => res.json())
      .then((data) => {
        setHistoryData(data);
        const uniq = Array.from(new Set(data.map((e) => e.session_id)));
        setSessions(uniq);
        const last =
          localStorage.getItem("last_session") || uniq[uniq.length - 1];
        setSelectedSession(last || "");
        if (last) {
          const msgs = data
            .filter((e) => e.session_id === last)
            .flatMap((e) => {
              const time = new Date().toLocaleTimeString();
              return [
                { sender: "user", text: e.mensaje_usuario, timestamp: time },
                { sender: "bot", text: e.respuesta_asistente, timestamp: time },
              ];
            });
          setMessages(msgs);
        } else {
          setMessages([
            {
              sender: "bot",
              text: "¡Hola! ¿En qué puedo ayudarte hoy?",
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
      })
      .catch(console.error);
  }, [status, session]);

  // Seleccionar sesión
  const selectSession = (id) => {
    setSelectedSession(id);
    setSidebarOpen(false); // <-- cerrar sidebar al seleccionar
    const msgs = historyData
      .filter((e) => e.session_id === id)
      .flatMap((e) => {
        const time = new Date().toLocaleTimeString();
        return [
          { sender: "user", text: e.mensaje_usuario, timestamp: time },
          { sender: "bot", text: e.respuesta_asistente, timestamp: time },
        ];
      });

    setMessages(
      msgs.length > 0
        ? msgs
        : [
            {
              sender: "bot",
              text: "¡Hola! ¿En qué puedo ayudarte hoy?",
              timestamp: new Date().toLocaleTimeString(),
            },
          ],
    );
  };

  const newChat = async () => {
    const id = `${session.user.email}_${Date.now()}`;

    const mensajeInicial = {
      sender: "bot",
      text: "¡Hola! ¿En qué puedo ayudarte hoy?",
      timestamp: new Date().toLocaleTimeString(),
    };

    await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/titulos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: id,
        titulo: "Chat sin título",
        user_email: session.user.email,
      }),
    });

    await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/historial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_email: session.user.email,
        mensaje_usuario: "",
        respuesta_asistente: mensajeInicial.text,
        session_id: id,
      }),
    });

    setCustomTitles((prev) => ({
      ...prev,
      [id]: "Chat sin título",
    }));
    setSessions((prev) => [...prev, id]);
    setSelectedSession(id);
    setMessages([mensajeInicial]);
  };

  // Enviar mensaje
  const sendMessage = async () => {
    const text = inputRef.current.value.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString();
    let currentSession = selectedSession;
    if (!currentSession) {
      // Sesión nueva sin ID, así que registramos el título por primera vez
      currentSession = `${session.user.email}_${Date.now()}`;
      setSelectedSession(currentSession);
      setSessions((prev) => [...prev, currentSession]);

      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/titulos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: currentSession,
          titulo: "Chat sin título",
          user_email: session.user.email,
        }),
      });

      setCustomTitles((prev) => ({
        ...prev,
        [currentSession]: "Chat sin título",
      }));
    }

    const updated = [...messages, { sender: "user", text, timestamp: time }];
    setMessages(updated);
    inputRef.current.value = "";

    // Si el título actual es "Chat sin título", lo actualizamos con el primer mensaje
    if (customTitles[currentSession] === "Chat sin título") {
      const nuevoTitulo = text.slice(0, 20);
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/titulos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: currentSession,
          titulo: nuevoTitulo,
          user_email: session.user.email,
        }),
      });
      setCustomTitles((prev) => ({
        ...prev,
        [currentSession]: nuevoTitulo,
      }));
    }

    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/consultar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: updated }),
      });
      const data = await res.json();
      const respuesta = data.respuesta;
      if (!respuesta) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: data.error || "Lo siento, hubo un problema. Intenta de nuevo.",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      if (respuesta) {
        const botMsg = {
          sender: "bot",
          text: respuesta,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, botMsg]);
        await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/historial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_email: session.user.email,
            mensaje_usuario: text,
            respuesta_asistente: respuesta,
            session_id: currentSession, // <-- CORRECTO
          }),
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "No pude conectar con el servidor. Revisa tu internet e intenta de nuevo.",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  //Carga los títulos personalizados
  useEffect(() => {
    if (status !== "authenticated") return;

    const cargarDatos = async () => {
      try {
        const [historialRes, titulosRes] = await Promise.all([
          apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/historial?email=${session.user.email}`,
          ),
          apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/titulos?email=${session.user.email}`,
          ),
        ]);

        const historial = await historialRes.json();
        const titulos = await titulosRes.json();

        // Guardar títulos personalizados en estado
        const titles = {};
        titulos.forEach(({ session_id, titulo }) => {
          titles[session_id] = titulo;
        });
        setCustomTitles(titles);

        // Guardar historial de conversaciones
        setHistoryData(historial);

        // Unimos historial y títulos con prioridad de títulos para orden
        const sesionesConFecha = titulos.map(({ session_id, creado_en }) => ({
          session_id,
          creado_en: new Date(creado_en),
        }));

        // Agrega sesiones que existan solo en historial y no en títulos
        historial.forEach(({ session_id }) => {
          if (!sesionesConFecha.find((s) => s.session_id === session_id)) {
            sesionesConFecha.push({
              session_id,
              creado_en: new Date(0), // muy antiguo para que quede al final
            });
          }
        });

        // Ordenar por fecha descendente
        const ordenadas = sesionesConFecha
          .sort((a, b) => b.creado_en - a.creado_en)
          .map((s) => s.session_id);

        setSessions(ordenadas);

        // Recuperar la última sesión activa desde localStorage si existe y es válida
        const lastStored = localStorage.getItem("last_session");
        const last =
          ordenadas.includes(lastStored) && lastStored
            ? lastStored
            : ordenadas[0];

        setSelectedSession(last || "");

        // Mostrar mensajes si hay historial
        if (last) {
          const msgs = historial
            .filter((e) => e.session_id === last)
            .flatMap((e) => {
              const time = new Date().toLocaleTimeString();
              return [
                { sender: "user", text: e.mensaje_usuario, timestamp: time },
                { sender: "bot", text: e.respuesta_asistente, timestamp: time },
              ];
            });

          if (msgs.length > 0) {
            setMessages(msgs);
          } else {
            setMessages([
              {
                sender: "bot",
                text: "¡Hola! ¿En qué puedo ayudarte hoy?",
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Error al cargar historial y títulos:", err);
      }
    };

    cargarDatos();
  }, [status, session]);

  //Click fuera del icono "..."
  useEffect(() => {
    const handleClickOutside = (e) => {
      const menus = document.querySelectorAll('[id^="session-menu-"]');
      let clickedInsideAnyMenu = false;

      menus.forEach((menu) => {
        if (menu.contains(e.target)) clickedInsideAnyMenu = true;
      });

      if (!clickedInsideAnyMenu) {
        setMenuSessionId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedSession) {
      localStorage.setItem("last_session", selectedSession);
    }
  }, [selectedSession]);

  // Mientras NextAuth valida
  if (loadingSession) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-500 text-xl">Cargando sesión…</p>
      </div>
    );
  }

  // Si no autenticado
  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso Restringido</h1>
          <div className="flex justify-center mb-6">
            <div className="w-28 h-28 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              <Image
                src={asset("/bot.png")}
                width={128}
                height={128}
                alt="GalgoAI Logo"
                className="object-contain"
              />
            </div>
          </div>
          <GoogleSignInButton />
        </div>
      </div>
    );
  }

  const filtered = sessions.filter((id) =>
    (customTitles[id] || id).toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <main className="relative h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-[60] transition-transform transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} w-64 bg-gray-100 p-4`}
      >
        {sidebarOpen && (
          <>
            <button
              onClick={newChat}
              className="mb-4 px-4 py-2 bg-white rounded shadow hover:shadow-md transition-shadow"
            >
              + Nuevo chat
            </button>

            <input
              type="text"
              placeholder="Buscar chat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4 p-2 border rounded focus:ring w-full"
            />
            {filtered.map((id) => {
              const first = historyData.find((e) => e.session_id === id);
              const snippet =
                customTitles[id] ||
                (first?.mensaje_usuario
                  ? first.mensaje_usuario.slice(0, 20) +
                    (first.mensaje_usuario.length > 20 ? "…" : "")
                  : id.split("_").pop());
              if (!id) return null;
              return (
                <div
                  key={id}
                  onClick={() => selectSession(id)}
                  className="mb-3 p-2 bg-white rounded hover:bg-gray-200 transition-colors cursor-pointer relative"
                >
                  {editingSessionId === id ? (
                    <input
                      autoFocus
                      type="text"
                      defaultValue={
                        customTitles[id] ||
                        historyData
                          .find((e) => e.session_id === id)
                          ?.mensaje_usuario.slice(0, 20) ||
                        ""
                      }
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const nuevo = e.target.value.trim();
                          if (nuevo && id) {
                            apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/titulos`,
                              {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  session_id: id,
                                  titulo: nuevo,
                                  user_email: session.user.email,
                                }),
                              },
                            ).then(() => {
                              setCustomTitles((prev) => ({
                                ...prev,
                                [id]: nuevo,
                              }));
                              setEditingSessionId(null);
                            });
                          }
                        } else if (e.key === "Escape") {
                          setEditingSessionId(null);
                        }
                      }}
                      className="w-full p-1 border rounded text-sm"
                    />
                  ) : (
                    <>
                      <p className="font-medium">
                        {customTitles[id] ||
                          historyData
                            .find((e) => e.session_id === id)
                            ?.mensaje_usuario.slice(0, 20) ||
                          id.split("_").pop()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {obtenerFechaLegible(id)}
                      </p>
                    </>
                  )}

                  {/* Botón menú de sesión */}
                  <button
                    className="absolute top-1 right-2 text-lg font-bold text-gray-500 hover:text-black cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuSessionId((prev) => (prev === id ? null : id));
                    }}
                  >
                    …
                  </button>

                  {/* Menú si está activo */}
                  {menuSessionId === id && (
                    <div
                      id={`session-menu-${id}`}
                      className="absolute right-2 top-7 w-32 bg-white border rounded shadow-md z-50"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(id);
                          setMenuSessionId(null);
                          // Mostrar campo de edición en línea (ya se maneja con menuSessionId === id)
                        }}
                        className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                      >
                        Renombrar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm("¿Seguro que deseas eliminar este chat?")
                          ) {
                            Promise.all([
                              apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/titulos`,
                                {
                                  method: "DELETE",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    session_id: id,
                                    user_email: session.user.email,
                                  }),
                                },
                              ),
                              apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/conversaciones`,
                                {
                                  method: "DELETE",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    session_id: id,
                                    user_email: session.user.email,
                                  }),
                                },
                              ),
                            ]).then(() => {
                              setHistoryData((prev) =>
                                prev.filter((e) => e.session_id !== id),
                              );
                              setSessions((prev) =>
                                prev.filter((sid) => sid !== id),
                              );
                              if (selectedSession === id) {
                                localStorage.removeItem("last_session");
                                setSelectedSession("");
                                setMessages([]);
                              }
                              setMenuSessionId(null);
                            });
                          }
                        }}
                        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </aside>

      {/* Overlay que se muestra detrás del sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/30 pointer-events-auto"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat area */}
      <section className="flex flex-col w-full h-full ml-0 transition-all duration-300">
        {/* Header con botón burger y logo a la izquierda */}
        <header className="relative flex items-center justify-between h-16 px-4 sm:px-6 bg-gradient-to-b from-teal-200 to-teal-500">
          {/* Izquierda: botón + logo */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              aria-label="Alternar menú"
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 text-white focus:outline-none hover:cursor-pointer"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <Image
              src={asset("/project-logo.png")}
              width={48}
              height={48}
              alt="GalgoAI Logo"
              className="object-contain w-10 h-10 sm:w-16 sm:h-16"
            />
          </div>

          {/* Título central */}
          <h1 className="absolute left-1/2 transform -translate-x-1/2 uppercase font-bold text-lg sm:text-2xl md:text-4xl lg:text-5xl font-pixel whitespace-nowrap">
            GALGOAI CHAT
          </h1>

          {/* Avatar a la derecha */}
          <div className="flex-shrink-0 mr-2 sm:mr-8 relative">
            <img
              src={session.user.image}
              alt="avatar"
              onClick={() => setMenuOpen((o) => !o)}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full cursor-pointer"
            />
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg rounded">
                <button
                  onClick={() =>
                    signOut()
                  }
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mensajes con avatars y burbujas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 pb-32 scroll-bg"
          style={{
            backgroundImage:
              `linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1)), url('${asset("/fondofinal.jpg")}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {messages.map((msg, i) => {
            const isUser = msg.sender === "user";
            const avatarSrc = isUser ? session.user.image : asset("/bot.png");
            return (
              <div
                key={i}
                className={`mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex items-center ${
                    isUser ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`mx-2 flex-shrink-0 ${
                      isUser ? "" : "bg-white p-1 rounded-full"
                    }`}
                  >
                    <img
                      src={avatarSrc}
                      alt={isUser ? "Tu perfil" : "Bot Galgo"}
                      className={`rounded-full object-contain ${
                        isUser ? "w-12 h-12" : "w-14 h-14"
                      }`}
                    />
                  </div>
                  {/* Globo de texto */}
                  <div
                    className={`
                      max-w-lg p-4 border text-black font-sans text-lg font-medium shadow-sm transition-shadow
                      ${
                        isUser
                          ? "bg-green-100 border-green-300 rounded-tl-lg rounded-bl-lg rounded-br-none"
                          : "bg-gray-100 border-gray-300 rounded-tr-lg rounded-br-lg rounded-bl-none"
                      }
                    `}
                  >
                    {msg.text}
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <footer className="p-4 bg-white border-t flex sm:static fixed bottom-0 left-0 w-full z-50">
          <textarea
            ref={inputRef}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Escribe un mensaje…"
            className="
              flex-1 border border-gray-300 rounded-full shadow-lg
              px-6 py-3 mr-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300
              text-black font-sans text-lg font-medium
            "
          />
          <button
            onClick={sendMessage}
            className="w-12 h-12 p-2 rounded-full bg-green-200 active:ring-2 active:ring-green-400 flex items-center justify-center transition-colors hover:bg-green-300"
          >
            <img
              src={asset("/send-icon.png")}
              alt="Enviar"
              className="w-full h-full object-contain"
            />
          </button>
        </footer>
      </section>
    </main>
  );
}
