import React, { useEffect, useState, useMemo } from "react";
import { obtenerRutaComodin } from "../firebase/rutasService";
import { getTiendasPorRepartidor } from "../firebase/tiendasService";
import { useAuth } from "../auth/authContext";
import MapaRutaComodin from "../components/RutaComodinMapa";
import Sidebar from "../components/Sidebar";
import Modal from "react-modal";
import "../styles/RutaComodin.css";
import Header from "../components/Header";

Modal.setAppElement("#root");

// Puedes poner false para diagnosticar sin mapa
const ENABLE_MAP = true;

/* ===========================
   Utils de geodistancia / orden
   =========================== */
const toRad = (d) => (d * Math.PI) / 180;
const haversine = (a, b) => {
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
};

const coerceNumber = (v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", ".").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// Acepta ubicaciones en {lat,lng}, GeoPoint {latitude,longitude}, "lat,lng" o [lat,lng]
const resolveCoords = (tienda) => {
  const u = tienda?.ubicacion;

  if (typeof tienda?.lat === "number" && typeof tienda?.lng === "number")
    return { lat: tienda.lat, lng: tienda.lng };

  if (u && (u.lat != null || u.lng != null)) {
    const lat = coerceNumber(u.lat);
    const lng = coerceNumber(u.lng);
    if (lat != null && lng != null) return { lat, lng };
  }
  if (u && (u.latitude != null || u.longitude != null)) {
    const lat = coerceNumber(u.latitude);
    const lng = coerceNumber(u.longitude);
    if (lat != null && lng != null) return { lat, lng };
  }
  if (typeof u === "string") {
    const [a, b] = u.split(/[, ]+/);
    const lat = coerceNumber(a);
    const lng = coerceNumber(b);
    if (lat != null && lng != null) return { lat, lng };
  }
  if (Array.isArray(u) && u.length >= 2) {
    const lat = coerceNumber(u[0]);
    const lng = coerceNumber(u[1]);
    if (lat != null && lng != null) return { lat, lng };
  }

  return null;
};

const normalizeStore = (tienda) => {
  const direccion = tienda?.direccion || {};
  return {
    ...tienda,
    calle: tienda?.calle ?? direccion?.calle ?? "",
    numero: tienda?.numero ?? direccion?.numero ?? "",
    colonia: tienda?.colonia ?? direccion?.colonia ?? "",
    referencias: tienda?.referencias ?? direccion?.referencias ?? "",
    fotoURL: tienda?.fotoURL ?? tienda?.imagen ?? "",
  };
};

const routeNearestNeighbor = (stores, start) => {
  const left = stores.slice();
  const ordered = [];
  let current = start;
  while (left.length) {
    let bestIdx = 0,
      bestDist = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = haversine(current, left[i].ubicacion);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = left.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = next.ubicacion;
  }
  return ordered;
};

/* ===========================
   Componente
   =========================== */
const RutaComodin = () => {
  const { user } = useAuth();

  // UI
  const [colapsado, setColapsado] = useState(false);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(null);
  const [imagenModal, setImagenModal] = useState(null);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
  const [gpsStart, setGpsStart] = useState(null);

  const puntoModal = useMemo(
    () => (ubicacionSeleccionada ? [ubicacionSeleccionada] : []),
    [ubicacionSeleccionada]
  );

  // Datos
  const [ruta, setRuta] = useState(null);
  const [tiendas, setTiendas] = useState([]);
  const [puntosTiendas, setPuntosTiendas] = useState([]);

  // Estado local (por día)
  const [omitidas, setOmitidas] = useState([]); // ids ocultas hoy
  const [entregadas, setEntregadas] = useState([]); // ids entregadas hoy
  const [ocultarEntregadas, setOcultarEntregadas] = useState(false);

  /* ---------- helpers de storage (scoped por día + comodín + repartidor) ---------- */
  const storageKey = (type) => {
    const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `rutas/${type}:${user?.uid || "anon"}:${ruta?.repartidorFaltante || "unknown"}:${hoy}`;
  };
  const loadArr = (type) => {
    try {
      const raw = localStorage.getItem(storageKey(type));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  const saveArr = (type, arr) =>
    localStorage.setItem(storageKey(type), JSON.stringify(arr));

  const quitarTienda = (tiendaId) => {
    if (
      tiendaSeleccionada != null &&
      tiendasOrdenadas[tiendaSeleccionada]?.id === tiendaId
    ) {
      setTiendaSeleccionada(null); // UX
    }
    setOmitidas((prev) => {
      const next = prev.includes(tiendaId) ? prev : [...prev, tiendaId];
      saveArr("omitidas", next);
      return next;
    });
  };
  const restaurarTienda = (tiendaId) => {
    setOmitidas((prev) => {
      const next = prev.filter((id) => id !== tiendaId);
      saveArr("omitidas", next);
      return next;
    });
  };
  const toggleEntregada = (tiendaId) => {
    setEntregadas((prev) => {
      const next = prev.includes(tiendaId)
        ? prev.filter((id) => id !== tiendaId)
        : [...prev, tiendaId];
      saveArr("entregadas", next);
      return next;
    });
  };
  const reiniciarListaHoy = () => {
    localStorage.removeItem(storageKey("omitidas"));
    localStorage.removeItem(storageKey("entregadas"));
    setOmitidas([]);
    setEntregadas([]);
  };

  /* ---------- carga de datos ---------- */
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;

      const datosRuta = await obtenerRutaComodin(user.uid);
      if (!datosRuta?.repartidorFaltante) return;

      setRuta(datosRuta);
      const tiendasRepartidor = await getTiendasPorRepartidor(
        datosRuta.repartidorFaltante
      );
      setTiendas((tiendasRepartidor || []).map(normalizeStore));
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) {
          setGpsStart({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => {}, // silencioso si falla/deniega
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 300000 }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Cargar estado local del día (omitidas / entregadas) cuando ya sabemos comodín y repartidor
  useEffect(() => {
    if (!user?.uid || !ruta?.repartidorFaltante) return;
    setOmitidas(loadArr("omitidas"));
    setEntregadas(loadArr("entregadas"));
  }, [user?.uid, ruta?.repartidorFaltante]);

  /* ---------- derivadas para lista/Mapa ---------- */
  const baseVisibles = useMemo(
    () => (Array.isArray(tiendas) ? tiendas.filter((t) => !omitidas.includes(t.id)) : []),
    [tiendas, omitidas]
  );

  const tiendasVisibles = useMemo(
    () => (ocultarEntregadas ? baseVisibles.filter((t) => !entregadas.includes(t.id)) : baseVisibles),
    [baseVisibles, ocultarEntregadas, entregadas]
  );

  // Normaliza solo las visibles (para poder medir distancias)
  const normalizadas = useMemo(() => {
    return (Array.isArray(tiendasVisibles) ? tiendasVisibles : [])
      .map((t) => {
        const ubicacion = resolveCoords(t);
        return ubicacion ? { id: t.id, nombre: t.nombre || "Sin nombre", ubicacion } : null;
      })
      .filter(Boolean);
  }, [tiendasVisibles]);

  // Calcula el orden consecutivo (Nearest-Neighbor)
  const ordenadasIds = useMemo(() => {
    if (normalizadas.length === 0) return [];
    const start = gpsStart ?? normalizadas[0].ubicacion; // GPS si existe, si no la primera
    const ordenados = routeNearestNeighbor(normalizadas, start);
    // Tienda 1 = más cercana al inicio
    return ordenados.map((t) => t.id).reverse();
  }, [normalizadas, gpsStart]);

  // Reconstruye la LISTA en ese orden
  const tiendasOrdenadas = useMemo(() => {
    const byId = new Map((tiendasVisibles || []).map((t) => [t.id, t]));
    return ordenadasIds.map((id) => byId.get(id)).filter(Boolean);
  }, [tiendasVisibles, ordenadasIds]);

  /* ================================================
     👇 CAMBIO: quitar del MAPA las ENTREGADAS/OMITIDAS
     ================================================ */
  // Version ordenada PARA EL MAPA: filtra fuera las entregadas SIEMPRE (ignora el toggle)
  const tiendasOrdenadasMapa = useMemo(
    () => tiendasOrdenadas.filter((t) => !entregadas.includes(t.id)),
    [tiendasOrdenadas, entregadas]
  );

  // Puntos para el MAPA desde tiendasOrdenadasMapa (ya sin entregadas ni omitidas)
  useEffect(() => {
    if (!Array.isArray(tiendasOrdenadasMapa) || tiendasOrdenadasMapa.length === 0) {
      setPuntosTiendas([]);
      return;
    }
    const pts = tiendasOrdenadasMapa
      .map((t) => {
        const ubicacion = resolveCoords(t);
        return ubicacion ? { id: t.id, nombre: t.nombre || "Sin nombre", ubicacion } : null;
      })
      .filter(Boolean);

    setPuntosTiendas(pts);
  }, [tiendasOrdenadasMapa]);
  /* ====== FIN CAMBIO ====== */

  /* === Memo para no crear nuevos arrays por render === */
  const puntosMemo = useMemo(() => puntosTiendas, [JSON.stringify(puntosTiendas)]);
  const puntoModalMemo = useMemo(() => puntoModal, [JSON.stringify(puntoModal)]);

  // ORIGEN para el mapa: GPS si existe; si no, primera tienda normalizada
  const origenMemo = useMemo(() => {
    if (gpsStart && Number.isFinite(gpsStart.lat) && Number.isFinite(gpsStart.lng)) {
      return gpsStart;
    }
    if (normalizadas.length > 0) {
      return normalizadas[0].ubicacion;
    }
    return null;
  }, [gpsStart, normalizadas]);

  /* ---------- handlers UI ---------- */
  const abrirImagen = (imagen) => setImagenModal(imagen);
  const cerrarImagen = () => setImagenModal(null);

  const abrirMapa = (coords) => {
    if (!coords?.lat || !coords?.lng) {
      console.warn("Coordenadas inválidas:", coords);
      return;
    }
    setUbicacionSeleccionada(coords);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 300);
  };
  const cerrarMapa = () => setUbicacionSeleccionada(null);

  const ui = useMemo(() => ({
  page: {
    flex: 1,
    padding: "1.5rem",
    marginLeft: colapsado ? "80px" : "250px",
    marginTop: "60px",
    transition: "margin-left 0.3s ease",
    overflowY: "auto",
    minHeight: "100vh",
    background: "#f8fafc",
  },
  sectionCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "1rem",
    marginBottom: "1rem",
  },
  title: {
    color: "#0f172a",
    marginTop: 0,
    marginBottom: "0.75rem",
  },
  subtitle: {
    color: "#64748b",
    marginBottom: "1.25rem",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "1rem",
    marginBottom: "1rem",
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "1rem",
  },
  label: {
    fontSize: "0.8rem",
    color: "#64748b",
    marginBottom: "0.35rem",
  },
  value: {
    fontSize: "1.2rem",
    fontWeight: "600",
    color: "#0f172a",
  },
  helper: {
    color: "#64748b",
    fontSize: "0.9rem",
  },
  badgeSuccess: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.35rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 600,
    background: "#dcfce7",
    color: "#166534",
  },
  badgeNeutral: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.35rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 600,
    background: "#e2e8f0",
    color: "#334155",
  },
  controlsWrap: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "1rem",
  },
  btnLight: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    padding: "0.7rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 500,
  },
  storeCard: {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "1rem",
  marginBottom: "0.9rem",
},
storeCardDelivered: {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
},
storeHeaderBtn: {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
},
storeTitleWrap: {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
},
storeName: {
  fontSize: "1rem",
  fontWeight: 600,
  color: "#0f172a",
},
storeSub: {
  fontSize: "0.85rem",
  color: "#64748b",
},
badgeDelivered: {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.35rem 0.65rem",
  borderRadius: "999px",
  fontSize: "0.78rem",
  fontWeight: 600,
  background: "#dcfce7",
  color: "#166534",
},
badgePending: {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.35rem 0.65rem",
  borderRadius: "999px",
  fontSize: "0.78rem",
  fontWeight: 600,
  background: "#eff6ff",
  color: "#1d4ed8",
},
detailGrid: {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "0.75rem",
  marginTop: "1rem",
},
detailItem: {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "0.75rem",
},
detailLabel: {
  fontSize: "0.78rem",
  color: "#64748b",
  marginBottom: "0.25rem",
},
detailValue: {
  fontSize: "0.95rem",
  color: "#0f172a",
  fontWeight: 500,
},
actionsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "0.75rem",
  marginTop: "1rem",
},
btnPrimary: {
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  padding: "0.8rem 1rem",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: 500,
},
btnWarning: {
  background: "#f59e0b",
  color: "#fff",
  border: "none",
  padding: "0.8rem 1rem",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: 500,
},
btnDanger: {
  background: "#ffffff",
  color: "#dc2626",
  border: "1px solid #fecaca",
  padding: "0.8rem 1rem",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: 500,
},
checkWrap: {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.7rem 0.85rem",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#fff",
},
emptyBox: {
  padding: "1rem",
  border: "1px dashed #cbd5e1",
  borderRadius: "12px",
  color: "#64748b",
  background: "#f8fafc",
},
}), [colapsado]);

const totalTiendas = tiendas.length;
const entregadasHoy = entregadas.filter((id) =>
  tiendas.some((t) => t.id === id)
).length;
const pendientes = Math.max(totalTiendas - entregadasHoy - omitidas.length, 0);
const estadoRuta = ruta ? "Ruta asignada" : "Sin ruta";


  /* ===========================
     Render
     =========================== */
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar colapsado={colapsado} setColapsado={setColapsado} />
      <Header
        titulo="Cobertura de ruta"
        usuario={user?.email || user?.displayName || "Comodín"}
        colapsado={colapsado}
      />

      <div style={ui.page}>
        <div style={ui.sectionCard}>
        <h2 style={ui.title}>Cobertura de ruta</h2>
        <p style={ui.subtitle}>
          Consulta tiendas asignadas, evidencia visual y ubicación del recorrido.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <span style={ruta ? ui.badgeSuccess : ui.badgeNeutral}>
            {estadoRuta}
          </span>
          <span style={ui.helper}>
            {ruta
              ? `Ruta vinculada al repartidor original: ${ruta.repartidorFaltante || "N/D"}`
              : "No hay una ruta activa asignada para este comodín."}
          </span>
        </div>
      </div>

      <div style={ui.statsGrid}>
        <div style={ui.statCard}>
          <div style={ui.label}>Tiendas totales</div>
          <div style={ui.value}>{totalTiendas}</div>
        </div>

        <div style={ui.statCard}>
          <div style={ui.label}>Pendientes</div>
          <div style={ui.value}>{pendientes}</div>
        </div>

        <div style={ui.statCard}>
          <div style={ui.label}>Entregadas</div>
          <div style={ui.value}>{entregadasHoy}</div>
        </div>

        <div style={ui.statCard}>
          <div style={ui.label}>Ocultas hoy</div>
          <div style={ui.value}>{omitidas.length}</div>
        </div>
      </div>

        <div style={ui.sectionCard}>
          <h3 style={ui.title}>Mapa de cobertura</h3>

          {ENABLE_MAP ? (
            <MapaRutaComodin
              comodinUid={user?.uid}
              puntos={puntosMemo}
              origen={origenMemo}
            />
          ) : (
            <div style={{ padding: "1rem", border: "1px dashed #cbd5e1", borderRadius: "12px" }}>
              <small>Mapa desactivado · Puntos: {puntosMemo.length}</small>
            </div>
          )}
        </div>

        <div style={ui.sectionCard}>
          <h3 style={ui.title}>Tiendas asignadas</h3>

          {/* Controles de lista */}
          <div style={ui.controlsWrap}>
            {(() => {
              const total = tiendas.length;
              const entregadasHoy = entregadas.filter((id) =>
                tiendas.some((t) => t.id === id)
              ).length;
              const pendientes = total - entregadasHoy - omitidas.length;
              return (
                <>
                  <span style={ui.helper}>
                    Pendientes: <strong>{pendientes}</strong> · Entregadas: <strong>{entregadasHoy}</strong> · Total: <strong>{totalTiendas}</strong>
                  </span>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={ocultarEntregadas}
                      onChange={(e) => setOcultarEntregadas(e.target.checked)}
                    />
                    Ocultar entregadas
                  </label>
                  <button style={ui.btnLight} onClick={reiniciarListaHoy}>
                    Reiniciar lista hoy
                  </button>
                </>
              );
            })()}
          </div>

          {tiendasOrdenadas.length === 0 ? (
            <div style={ui.emptyBox}>
              No hay tiendas disponibles para mostrar en esta ruta.
            </div>
          ) : (
            tiendasOrdenadas.map((tienda, index) => {
              const isEntregada = entregadas.includes(tienda.id);

              const latRaw = tienda?.ubicacion?.lat;
              const lngRaw = tienda?.ubicacion?.lng;
              const lat =
                typeof latRaw === "string" && latRaw.trim() !== ""
                  ? parseFloat(latRaw.trim())
                  : latRaw;
              const lng =
                typeof lngRaw === "string" && lngRaw.trim() !== ""
                  ? parseFloat(lngRaw.trim())
                  : lngRaw;
              const ubicacionValida =
                typeof lat === "number" &&
                typeof lng === "number" &&
                !isNaN(lat) &&
                !isNaN(lng);

              return (
                <div
                  key={tienda.id}
                  style={{
                    ...ui.storeCard,
                    ...(isEntregada ? ui.storeCardDelivered : {}),
                  }}
                >
                  <button
                    style={ui.storeHeaderBtn}
                    onClick={() =>
                      setTiendaSeleccionada(index === tiendaSeleccionada ? null : index)
                    }
                  >
                    <div style={ui.storeTitleWrap}>
                      <div style={ui.storeName}>
                        {tienda.nombre || `Tienda ${index + 1}`}
                      </div>
                      <div style={ui.storeSub}>
                        {tienda.calle || "Sin calle"} {tienda.numero ? `#${tienda.numero}` : ""}
                        {tienda.colonia ? ` · ${tienda.colonia}` : ""}
                      </div>
                    </div>

                    <span style={isEntregada ? ui.badgeDelivered : ui.badgePending}>
                      {isEntregada ? "Entregada" : "Pendiente"}
                    </span>
                  </button>

                  {index === tiendaSeleccionada && (
                    <>
                      <div style={ui.detailGrid}>
                        <div style={ui.detailItem}>
                          <div style={ui.detailLabel}>Color de fachada</div>
                          <div style={ui.detailValue}>{tienda.colorFachada || "-"}</div>
                        </div>

                        <div style={ui.detailItem}>
                          <div style={ui.detailLabel}>Calle</div>
                          <div style={ui.detailValue}>{tienda.calle || "-"}</div>
                        </div>

                        <div style={ui.detailItem}>
                          <div style={ui.detailLabel}>Número</div>
                          <div style={ui.detailValue}>{tienda.numero || "-"}</div>
                        </div>

                        <div style={ui.detailItem}>
                          <div style={ui.detailLabel}>Colonia</div>
                          <div style={ui.detailValue}>{tienda.colonia || "-"}</div>
                        </div>

                        <div style={ui.detailItem}>
                          <div style={ui.detailLabel}>Referencias</div>
                          <div style={ui.detailValue}>{tienda.referencias || "-"}</div>
                        </div>
                      </div>

                      <div style={ui.actionsGrid}>
                        <label style={ui.checkWrap}>
                          <input
                            type="checkbox"
                            checked={isEntregada}
                            onChange={() => toggleEntregada(tienda.id)}
                          />
                          Marcar como entregada
                        </label>

                        <button
                          style={ui.btnPrimary}
                          onClick={() => abrirImagen(tienda.fotoURL)}
                        >
                          Ver foto
                        </button>

                        {ubicacionValida ? (
                          <button
                            style={ui.btnWarning}
                            onClick={() => abrirMapa({ lat, lng })}
                          >
                            Ver ubicación
                          </button>
                        ) : (
                          <div style={ui.detailItem}>
                            <div style={ui.detailLabel}>Ubicación</div>
                            <div style={{ ...ui.detailValue, color: "#b91c1c" }}>
                              No disponible
                            </div>
                          </div>
                        )}

                        <button
                          style={ui.btnDanger}
                          onClick={() => quitarTienda(tienda.id)}
                        >
                          Quitar de la lista
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}

          {/* Panel para deshacer omitidas */}
          {omitidas.length > 0 && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: "12px",
              }}
            >
              <strong>Omitidas hoy ({omitidas.length}):</strong>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                {omitidas.map((id) => {
                const tienda = tiendas.find((t) => t.id === id);
                return (
                  <button
                    key={id}
                    className="btn btn-sm btn-light"
                    onClick={() => restaurarTienda(id)}
                  >
                    Deshacer {tienda?.nombre || "tienda"}
                  </button>
                );
              })}
              </div>
            </div>
          )}
          </div>
      </div>

      {/* Modal Imagen */}
      <Modal
        isOpen={!!imagenModal}
        onRequestClose={cerrarImagen}
        className="custom-modal"
        overlayClassName="custom-overlay"
      >
        <button className="btn-cerrar" onClick={cerrarImagen}>✖ Cerrar</button>
        <img src={imagenModal} alt="Tienda" className="imagen-modal" />
      </Modal>

      {/* Modal Mapa con ubicación única */}
      <Modal
        isOpen={!!ubicacionSeleccionada}
        onRequestClose={cerrarMapa}
        style={{
          content: {
            top: "50%", left: "50%", right: "auto", bottom: "auto",
            marginRight: "-50%", transform: "translate(-50%, -50%)",
            width: "90vw", height: "90vh", padding: "2rem",
            borderRadius: "15px", overflow: "hidden",
          },
          overlay: { backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1000 },
        }}
      >
        <button className="btn-cerrar" onClick={cerrarMapa}>✖ Cerrar</button>
        <div style={{ height: "100%", width: "100%" }}>
          {ENABLE_MAP ? (
            <MapaRutaComodin
              comodinUid={user?.uid}
              puntos={puntosMemo}
              origen={origenMemo}
            />
          ) : (
            <div style={{ padding: "1rem", border: "1px dashed #ccc", borderRadius: 8 }}>
              <small>Mapa desactivado · Punto modal: {puntoModalMemo.length}</small>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RutaComodin;
