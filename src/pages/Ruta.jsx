import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { useAuth } from "../auth/authContext";
import {
  iniciarRecorrido as iniciarRecorridoService,
  finalizarRecorrido as finalizarRecorridoService,
  onRecorridoActivo,
  obtenerRutaComodin,           //
} from "../firebase/rutasService";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore"; // 
import { addDoc, collection, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebaseConfig";


const Ruta = () => {
  const [recorrido, setRecorrido] = useState(null);
  const [puntos, setPuntos] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [ubicacionActual, setUbicacionActual] = useState(null);
  const [kilos, setKilos] = useState("");
  const [frias, setFrias] = useState("");
  const [watchId, setWatchId] = useState(null);
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [agotado, setAgotado] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [cargandoUbicacionTienda, setCargandoUbicacionTienda] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const { user } = useAuth();
  const TERMINOS = {
  unidad: "unidades",
  unidadSingular: "unidad",
  cargaInicial: "Carga inicial",
  disponible: "Disponible",
  entregado: "Entregado",
  devuelto: "Devuelto",
  registrarPunto: "Registrar movimiento",
  agregarEntrega: "Agregar movimiento",
  agregarRecogida: "Registrar devolución",
  iniciarRecorrido: "Iniciar ruta",
  finalizarRecorrido: "Finalizar ruta",
  rutaActiva: "Ruta activa",
  sinRecorrido: "Sin ruta",
  movimientos: "Movimientos registrados",
};
  const [agregandoTienda, setAgregandoTienda] = useState(false);
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [notificacion, setNotificacion] = useState(null);
  const [nuevaTienda, setNuevaTienda] = useState({
  nombre: "",
  calle: "",
  numero: "",
  colonia: "",
  referencias: "",
  colorFachada: "",
  fotoFile: null,
});

const startTracking = (rid) => {
  if (!rid) return;
  if (watchId) {
    try { navigator.geolocation.clearWatch(watchId); } catch {}
  }
  const id = navigator.geolocation.watchPosition(
    async (position) => {
      const nuevaUbicacion = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      // 🔁 LocalStorage (ruta viva)
      const key = `posicion_actual_${user.uid}`;
      const datos = JSON.parse(localStorage.getItem(key)) || { ruta: [] };
      datos.actual = nuevaUbicacion;
      datos.ruta.push(nuevaUbicacion);
      localStorage.setItem(key, JSON.stringify(datos));

      // 🔥 Firestore para que admin vea en vivo
      try {
        await updateDoc(doc(db, "recorridos", rid), { ubicacionActual: nuevaUbicacion });
      } catch (e) {
        console.warn("No se pudo actualizar la ubicación en Firestore:", e);
      }
    },
    (error) => console.error("Error en tracking:", error),
    { enableHighAccuracy: true, maximumAge: 0 }
  );
  setWatchId(id);
};


  const distanciaEnMetros = (p1, p2) => {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (p2.lat - p1.lat) * rad;
    const dLon = (p2.lng - p1.lng) * rad;
    const lat1 = p1.lat * rad;
    const lat2 = p2.lat * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const obtenerUbicacion = (preferencias = null) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject("Geolocalización no soportada");
      const opciones = preferencias || { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
      navigator.geolocation.getCurrentPosition(
        position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        error => {
          if (error.code === 3) {
            navigator.geolocation.getCurrentPosition(
              position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
              err => reject("Error al obtener ubicación: " + err.message),
              { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
            );
          } else {
            reject("Error al obtener ubicación: " + error.message);
          }
        },
        opciones
      );
    });
  };


  const guardarTienda = async () => {
  try {
    if (!ubicacionActual) throw new Error("Ubicación no disponible");

    const { nombre, calle, numero, colonia, referencias, colorFachada, fotoFile } = nuevaTienda;

    if (!nombre || !calle || !numero || !colonia) {
      mostrarNotificacion("Completa todos los campos obligatorios.", "error");
      return;
    }

    let fotoURL = "";

    console.log("1. Iniciando guardado de tienda...");
    console.log("2. Datos base:", {
      nombre,
      calle,
      numero,
      colonia,
      referencias,
      colorFachada,
      tieneFoto: !!fotoFile
    });

    if (fotoFile) {
      console.log("3. Subiendo archivo a Storage...", fotoFile.name);

      const rutaArchivo = `fotosTiendas/${user.uid}/${Date.now()}_${fotoFile.name}`;
      const storageRef = ref(storage, rutaArchivo);

      const snapshot = await uploadBytes(storageRef, fotoFile);
      console.log("4. Archivo subido correctamente:", snapshot);

      fotoURL = await getDownloadURL(snapshot.ref);
      console.log("5. URL obtenida correctamente:", fotoURL);
    }

    const tiendaData = {
      nombre,
      repartidorUid: user.uid,
      direccion: { calle, numero, colonia, referencias },
      colorFachada,
      ubicacion: ubicacionActual,
      fotoURL,
      fechaRegistro: serverTimestamp(),
      activa: true,
      notas: ""
    };

    console.log("6. Documento a guardar en Firestore:", tiendaData);

    const docRef = await addDoc(collection(db, "tiendas"), tiendaData);
    console.log("7. Tienda guardada correctamente con ID:", docRef.id);

    mostrarNotificacion("La tienda se registró correctamente.", "success");
    setAgregandoTienda(false);
    setNuevaTienda({
      nombre: "",
      calle: "",
      numero: "",
      colonia: "",
      referencias: "",
      colorFachada: "",
      fotoFile: null
    });

  } catch (err) {
    console.error("❌ Error real al guardar tienda:", err);
    mostrarNotificacion(`No se pudo guardar la tienda: ${err.message || "error desconocido"}`, "error");
  }
};

  const iniciarRecorrido = async () => {
    // Si ya hay uno en memoria, evita doble clic
    if (recorrido?.recorridoId) return;
  
  const cantidadInicial = prompt(`¿Cuál es la cantidad inicial de ${TERMINOS.unidad} para esta ruta?`);
  const cantidadInicialNumerica = parseFloat(cantidadInicial);
  if (isNaN(cantidadInicialNumerica) || cantidadInicialNumerica <= 0) {
    mostrarNotificacion(`Ingresa una cantidad inicial válida de ${TERMINOS.unidad}.`, "error");
    return;
  }
  
    const ubic = await obtenerUbicacion();
    // Esta llamada YA respeta el candado (si existe, devuelve el existente)
    const rid = await iniciarRecorridoService(user.uid, ubic, cantidadInicialNumerica);
    if (!rid) return;
  
    // Cargar el doc real (para no pisar datos si ya existía)
    try {
      const snap = await getDoc(doc(db, "recorridos", rid));
      if (snap.exists()) {
        const data = snap.data();
        setRecorrido({
          recorridoId: rid,
          horaInicio: data.horaInicio || new Date().toISOString(),
          inicioUbicacion: data.inicioUbicacion || ubic,
          kilosIniciales: cantidadInicialNumerica,
          kilosRestantes: cantidadInicialNumerica,
        });
        setPuntos(Array.isArray(data.puntos) ? data.puntos : []);
      } else {
        // Fallback (no debería pasar)
        setRecorrido({
          recorridoId: rid,
          horaInicio: new Date().toISOString(),
          inicioUbicacion: ubic,
          kilosIniciales,
          kilosRestantes: kilosIniciales,
        });
        setPuntos([]);
      }
    } catch (e) {
      console.warn("No se pudo leer el recorrido recién iniciado:", e);
    }
  
    localStorage.setItem(
      `posicion_actual_${user.uid}`,
      JSON.stringify({ actual: ubic, ruta: [ubic] })
    );
    startTracking(rid);
  };
    

const mostrarFormularioEntrega = async () => {
  setFormVisible(true);
  setUbicacionActual(null);
  setCargandoUbicacion(true);

  try {
    const ubic = await obtenerUbicacion();
    setUbicacionActual(ubic);
  } catch (err) {
    setFormVisible(false);
    mostrarNotificacion("No se pudo obtener tu ubicación actual. Revisa permisos del navegador.", "error");
  } finally {
    setCargandoUbicacion(false);
  }
};

  useEffect(() => {
    if (!recorrido || !agotado) return;
    let yaFinalizado = false;
    const intervalo = setInterval(async () => {
      try {
        const pos = await obtenerUbicacion();
        const distancia = distanciaEnMetros(recorrido.inicioUbicacion, pos);
        if (distancia <= 50 && !yaFinalizado) {
          yaFinalizado = true;
          mostrarNotificacion("La ruta se finalizó automáticamente al regresar al origen sin disponibilidad restante.", "info");
          await finalizarRecorrido();
        }
      } catch (error) {
        console.warn("No se pudo obtener ubicación periódica:", error);
      }
    }, 10000);
    return () => clearInterval(intervalo);
  }, [recorrido, agotado]);

  const finalizarRecorrido = async () => {
    if (finalizando || !recorrido?.recorridoId) return;
    setFinalizando(true);
    try {
      const ubic = await obtenerUbicacion();
      if (!ubic || typeof ubic.lat !== "number" || typeof ubic.lng !== "number") {
        throw new Error("Ubicación final inválida.");
      }
      const horaFin = new Date().toISOString();
      const duracionTotalMin = Math.floor((new Date(horaFin) - new Date(recorrido.horaInicio)) / 60000);
  
      await finalizarRecorridoService(recorrido.recorridoId, {
        finUbicacion: ubic,
        kilosRestantes: recorrido.kilosRestantes,
        duracionTotalMin,
        puntos
      });
  
      mostrarNotificacion("El recorrido se finalizó y la información quedó guardada correctamente.", "success");
      setRecorrido(null);
      setPuntos([]);
      setFormVisible(false);
      setAgotado(false);
    } catch (error) {
      console.error("❌ Error al finalizar recorrido:", error);
      mostrarNotificacion("No se pudo finalizar el recorrido. Verifica conexión o ubicación.", "error");
    } finally {
      try { if (watchId) navigator.geolocation.clearWatch(watchId); } catch {}
      localStorage.removeItem(`posicion_actual_${user.uid}`);
      setFinalizando(false);
    }
  };
  
const guardarEntrega = async () => {
  if (!ubicacionActual) {
    mostrarNotificacion("Ubicación no disponible.", "error");
    return;
  }

  const entregadosKg = parseFloat(kilos);
  const friasKg = parseFloat(frias);

  if ((!agotado && (isNaN(entregadosKg) || entregadosKg <= 0)) && isNaN(friasKg)) {
    mostrarNotificacion("Ingresa al menos una cantidad válida para registrar el movimiento.", "error");
    return;
  }

  const nuevoPunto = {
    hora: new Date().toISOString(),
    ubicacion: ubicacionActual,
    entregados: agotado ? 0 : (entregadosKg || 0),
    frias: friasKg || 0,
  };

  // 🔑 CALCULO CENTRAL CORRECTO
  const restantesCalculados = !agotado && recorrido
    ? Math.max((recorrido.kilosRestantes || 0) - (entregadosKg || 0), 0)
    : (recorrido?.kilosRestantes || 0);

  try {
    // 🔥 ACTUALIZAS TODO JUNTO (NO SOLO puntos)
    await updateDoc(doc(db, "recorridos", recorrido.recorridoId), {
      puntos: arrayUnion(nuevoPunto),
      kilosRestantes: restantesCalculados
    });

    // ✅ estado local sincronizado
    setPuntos(prev => [...prev, nuevoPunto]);

    setRecorrido(prev => ({
      ...prev,
      kilosRestantes: restantesCalculados
    }));

    if (restantesCalculados <= 0) {
      setAgotado(true);
    }

    // limpieza
    setUbicacionActual(null);
    setKilos("");
    setFrias("");
    setFormVisible(false);

  } catch (error) {
    console.error("❌ Error actualizando punto en Firestore:", error);
    mostrarNotificacion("No se pudo guardar el movimiento en la base de datos.", "error");
  }
};

useEffect(() => {
  if (!user?.uid) return;
  const unsub = onRecorridoActivo(user.uid, async (rid) => {
    if (!rid) {
      // No hay recorrido activo
      setRecorrido(null);
      setPuntos([]);
      if (watchId) try { navigator.geolocation.clearWatch(watchId); } catch {}
      return;
    }
    // Cargar datos del recorrido activo
    try {
      const snap = await getDoc(doc(db, "recorridos", rid));
      if (snap.exists()) {
        const data = snap.data();
        setRecorrido({
          recorridoId: rid,
          horaInicio: data.horaInicio || new Date().toISOString(),
          inicioUbicacion: data.inicioUbicacion || null,
          kilosIniciales: data.kilosIniciales ?? 0,
          kilosRestantes: data.kilosRestantes ?? (data.kilosIniciales ?? 0),
        });
        setAgotado((data.kilosRestantes ?? data.kilosIniciales ?? 0) <= 0);
        setPuntos(Array.isArray(data.puntos) ? data.puntos : []);
        startTracking(rid); // reanuda tracking
      } else {
        setRecorrido(null);
        setPuntos([]);
      }
    } catch (e) {
      console.error("Error cargando recorrido activo:", e);
    }
  });
  return () => unsub && unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user?.uid]);

useEffect(() => {
  const fetchTiendas = async () => {
    const ruta = await obtenerRutaComodin(user.uid);
    if (!ruta || !ruta.repartidorFaltante) return;

    const q = query(
      collection(db, "tiendas"),
      where("repartidorUid", "==", ruta.repartidorFaltante)
    );
    const snapshot = await getDocs(q);
    const tiendasArray = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setTiendas(tiendasArray);
  };

  fetchTiendas();
}, [user.uid]);

const ui = useMemo(() => ({
  page: {
    padding: "1.5rem",
    marginLeft: sidebarColapsado ? "60px" : "220px",
    marginTop: "60px",
    minHeight: "100vh",
    background: "#f8fafc",
  },
  subtitle: {
    color: "#64748b",
    marginBottom: "1.5rem",
  },
  sectionCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "1rem",
    marginBottom: "1rem",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
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
    marginBottom: "0.3rem",
  },
  value: {
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "#0f172a",
  },
  actionsWrap: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  btnPrimary: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 500,
  },
  btnDark: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 500,
  },
  btnLight: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 500,
  },
  btnDanger: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 500,
  },
  title: {
    color: "#0f172a",
    marginTop: 0,
    marginBottom: "0.8rem",
  },
  tableContainer: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "1rem",
    marginTop: "1rem",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "0.75rem",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "left",
    background: "#f8fafc",
    color: "#0f172a",
  },
  td: {
    padding: "0.75rem",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
    verticalAlign: "top",
  },
  emptyState: {
    color: "#64748b",
    margin: 0,
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
  helper: {
    color: "#64748b",
    fontSize: "0.9rem",
    marginTop: "0.35rem",
  },
  warningBox: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    borderRadius: "12px",
    padding: "0.9rem 1rem",
    marginBottom: "1rem",
    fontWeight: 500,
  },
    modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "1rem",
  },
  modalCard: {
    width: "100%",
    maxWidth: "520px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "1.25rem",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.18)",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.45rem",
    marginBottom: "1rem",
  },
  input: {
    padding: "0.8rem 0.9rem",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    outline: "none",
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    marginTop: "1rem",
  },
  storeGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
},
textarea: {
  padding: "0.8rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  outline: "none",
  minHeight: "90px",
  resize: "vertical",
},
fileBox: {
  border: "1px dashed #94a3b8",
  borderRadius: "10px",
  padding: "1rem",
  background: "#f8fafc",
},
toast: {
  position: "fixed",
  right: "1.5rem",
  bottom: "1.5rem",
  zIndex: 10000,
  minWidth: "280px",
  maxWidth: "420px",
  borderRadius: "12px",
  padding: "0.9rem 1rem",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
},
toastSuccess: {
  borderLeft: "5px solid #16a34a",
},
toastError: {
  borderLeft: "5px solid #dc2626",
},
toastInfo: {
  borderLeft: "5px solid #3b82f6",
},
toastTitle: {
  fontSize: "0.85rem",
  fontWeight: 700,
  marginBottom: "0.25rem",
  color: "#0f172a",
},
toastText: {
  margin: 0,
  color: "#334155",
  fontSize: "0.95rem",
},
  
}), [sidebarColapsado]);

  const estadoRuta = recorrido ? TERMINOS.rutaActiva : TERMINOS.sinRecorrido;
  const horaInicioTexto = recorrido?.horaInicio
    ? new Date(recorrido.horaInicio).toLocaleTimeString()
    : "--:--";
  const ubicacionInicioTexto = recorrido?.inicioUbicacion
    ? `${recorrido.inicioUbicacion.lat.toFixed(5)}, ${recorrido.inicioUbicacion.lng.toFixed(5)}`
    : "Sin ubicación";
  const kilosInicialesTexto = recorrido?.kilosIniciales ?? 0;
  const kilosRestantesTexto = recorrido?.kilosRestantes ?? 0;

  const mostrarNotificacion = (mensaje, tipo = "success") => {
  setNotificacion({ mensaje, tipo });

  setTimeout(() => {
    setNotificacion(null);
  }, 3500);
};

  return (
    <>
      <Sidebar colapsado={sidebarColapsado} setColapsado={setSidebarColapsado} />
      <Header 
        titulo="Ruta de Entregas" 
        usuario={user?.email || user?.displayName || "Repartidor"} 
        colapsado={sidebarColapsado} 
      />

      <div style={ui.page}>
        <p style={ui.subtitle}>
          Gestiona tu ruta, registra entregas, captura nuevas tiendas y da seguimiento operativo en tiempo real.
        </p>

        {notificacion && (
          <div
            style={{
              ...ui.toast,
              ...(notificacion.tipo === "success"
                ? ui.toastSuccess
                : notificacion.tipo === "error"
                ? ui.toastError
                : ui.toastInfo),
            }}
          >
            <div style={ui.toastTitle}>
              {notificacion.tipo === "success"
                ? "Operación completada"
                : notificacion.tipo === "error"
                ? "Atención"
                : "Información"}
            </div>
            <p style={ui.toastText}>{notificacion.mensaje}</p>
          </div>
        )}
        
        <div style={ui.sectionCard}>
          <h3 style={ui.title}>Estado del recorrido</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={recorrido ? ui.badgeSuccess : ui.badgeNeutral}>
              {estadoRuta}
            </span>
            <span style={ui.helper}>
              {recorrido
                ? "La ruta está en curso y lista para registrar movimientos."
                : "Aún no has iniciado un recorrido."}
            </span>
          </div>
        </div>

        <div style={ui.statsGrid}>
          <div style={ui.statCard}>
            <div style={ui.label}>Hora de inicio</div>
            <div style={ui.value}>{horaInicioTexto}</div>
          </div>

          <div style={ui.statCard}>
            <div style={ui.label}>Ubicación inicial</div>
            <div style={{ ...ui.value, fontSize: "1rem" }}>{ubicacionInicioTexto}</div>
          </div>

          <div style={ui.statCard}>
            <div style={ui.label}>{TERMINOS.cargaInicial}</div>
            <div style={ui.value}>{kilosInicialesTexto} {TERMINOS.unidad}</div>
          </div>

          <div style={ui.statCard}>
            <div style={ui.label}>{TERMINOS.disponible}</div>
            <div style={ui.value}>{kilosRestantesTexto} {TERMINOS.unidad}</div>
          </div>
        </div>

        <div style={ui.sectionCard}>
          <h3 style={ui.title}>Acciones operativas</h3>
          <div style={ui.actionsWrap}>
            {!recorrido && (
              <button onClick={iniciarRecorrido} style={ui.btnPrimary}>
                {TERMINOS.iniciarRecorrido}
              </button>
            )}

            {recorrido && recorrido.kilosRestantes > 0 && !formVisible && !agregandoTienda && (
              <>
                <button onClick={mostrarFormularioEntrega} style={ui.btnPrimary}>
                  {TERMINOS.agregarEntrega}
                </button>

                <button onClick={finalizarRecorrido} style={ui.btnDark}>
                  {TERMINOS.finalizarRecorrido}
                </button>

                <button
                  onClick={async () => {
                    try {
                      const ubic = await obtenerUbicacion();
                      setUbicacionActual(ubic);
                      setAgregandoTienda(true);
                    } catch (err) {
                      mostrarNotificacion("No se pudo obtener tu ubicación para agregar la tienda.", "error");
                    }
                  }}
                  style={ui.btnLight}
                >
                  Agregar nueva tienda
                </button>
              </>
            )}

            {recorrido && recorrido.kilosRestantes <= 0 && !formVisible && !agregandoTienda && (
              <>
                <button onClick={mostrarFormularioEntrega} style={ui.btnPrimary}>
                  Agregar punto de recogida
                </button>

                <button onClick={finalizarRecorrido} style={ui.btnDark}>
                  Finalizar recorrido
                </button>

                <button
                  onClick={async () => {
                    try {
                      const ubic = await obtenerUbicacion();
                      setUbicacionActual(ubic);
                      setAgregandoTienda(true);
                    } catch (err) {
                      alert("No se pudo obtener tu ubicación para agregar la tienda.");
                    }
                  }}
                  style={ui.btnLight}
                >
                  Agregar nueva tienda
                </button>
              </>
            )}
          </div>
        </div>

        {recorrido && (
          <>

          {recorrido.kilosRestantes <= 0 && (
            <div style={ui.warningBox}>
              Ya no queda disponibilidad para registrar entregas. Puedes seguir registrando devoluciones o finalizar la ruta.
            </div>
          )}

          {agregandoTienda && ubicacionActual && (
            <div style={ui.sectionCard}>
              <h3 style={ui.title}>Registrar nueva tienda</h3>
              <p style={ui.subtitle}>
                Captura la información del nuevo punto para integrarlo a la operación.
              </p>

              <div style={{ ...ui.sectionCard, marginBottom: "1rem", padding: "0.85rem" }}>
                <div style={ui.label}>Ubicación detectada</div>
                <div style={{ ...ui.value, fontSize: "1rem" }}>
                  {ubicacionActual.lat.toFixed(5)}, {ubicacionActual.lng.toFixed(5)}
                </div>
              </div>

              <div style={ui.storeGrid}>
                <div style={ui.formGroup}>
                  <label style={ui.label}>Nombre de la tienda</label>
                  <input
                    value={nuevaTienda.nombre}
                    onChange={e => setNuevaTienda({ ...nuevaTienda, nombre: e.target.value })}
                    style={ui.input}
                    placeholder="Ej. Tienda San Miguel"
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Calle</label>
                  <input
                    value={nuevaTienda.calle}
                    onChange={e => setNuevaTienda({ ...nuevaTienda, calle: e.target.value })}
                    style={ui.input}
                    placeholder="Nombre de la calle"
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Número</label>
                  <input
                    value={nuevaTienda.numero}
                    onChange={e => setNuevaTienda({ ...nuevaTienda, numero: e.target.value })}
                    style={ui.input}
                    placeholder="Número exterior o interior"
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Colonia</label>
                  <input
                    value={nuevaTienda.colonia}
                    onChange={e => setNuevaTienda({ ...nuevaTienda, colonia: e.target.value })}
                    style={ui.input}
                    placeholder="Colonia"
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Color de fachada</label>
                  <input
                    value={nuevaTienda.colorFachada}
                    onChange={e => setNuevaTienda({ ...nuevaTienda, colorFachada: e.target.value })}
                    style={ui.input}
                    placeholder="Ej. Blanco con azul"
                  />
                </div>

                <div style={ui.formGroup}>
                  <label style={ui.label}>Fotografía</label>
                  <div style={ui.fileBox}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setNuevaTienda({ ...nuevaTienda, fotoFile: e.target.files[0] })}
                    />
                    <div style={ui.helper}>
                      Agrega una imagen de referencia de la fachada si está disponible.
                    </div>
                  </div>
                </div>
              </div>

              <div style={ui.formGroup}>
                <label style={ui.label}>Referencias</label>
                <textarea
                  value={nuevaTienda.referencias}
                  onChange={e => setNuevaTienda({ ...nuevaTienda, referencias: e.target.value })}
                  style={ui.textarea}
                  placeholder="Señas particulares, ubicación visual o datos útiles para futuras visitas"
                />
              </div>

              <div style={ui.modalActions}>
                <button onClick={() => setAgregandoTienda(false)} style={ui.btnLight}>
                  Cancelar
                </button>

                <button onClick={guardarTienda} style={ui.btnPrimary}>
                  Guardar tienda
                </button>
              </div>
            </div>
          )}


            {formVisible && (
            <div style={ui.modalOverlay}>
              <div style={ui.modalCard}>
                <h3 style={ui.title}>{TERMINOS.registrarPunto}</h3>

                {cargandoUbicacion ? (
                  <div style={ui.sectionCard}>
                    <div style={ui.label}>Ubicación actual</div>
                    <div style={{ ...ui.value, fontSize: "1rem" }}>
                      Obteniendo ubicación...
                    </div>
                    <div style={ui.helper}>
                      Espera un momento mientras se detecta tu posición.
                    </div>
                  </div>
                ) : !ubicacionActual ? (
                  <div style={ui.sectionCard}>
                    <div style={{ ...ui.value, fontSize: "1rem" }}>
                      No se pudo obtener la ubicación.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ ...ui.sectionCard, marginBottom: "1rem", padding: "0.85rem" }}>
                      <div style={ui.label}>Ubicación actual</div>
                      <div style={{ ...ui.value, fontSize: "1rem" }}>
                        {ubicacionActual.lat.toFixed(5)}, {ubicacionActual.lng.toFixed(5)}
                      </div>
                    </div>

                    {!agotado && (
                      <div style={ui.formGroup}>
                        <label style={ui.label}>Cantidad entregada</label>
                        <input
                          type="number"
                          value={kilos}
                          onChange={e => setKilos(e.target.value)}
                          disabled={recorrido.kilosRestantes <= 0}
                          style={ui.input}
                          placeholder={`Ingresa la cantidad entregada en ${TERMINOS.unidad}`}
                        />
                      </div>
                    )}

                    <div style={ui.formGroup}>
                      <label style={ui.label}>Cantidad devuelta</label>
                      <input
                        type="number"
                        value={frias}
                        onChange={e => setFrias(e.target.value)}
                        style={ui.input}
                        placeholder={`Ingresa la cantidad devuelta en ${TERMINOS.unidad}`}
                      />
                    </div>
                  </>
                )}

                <div style={ui.modalActions}>
                  <button onClick={() => setFormVisible(false)} style={ui.btnLight}>
                    Cancelar
                  </button>

                  <button
                    onClick={guardarEntrega}
                    style={ui.btnPrimary}
                    disabled={cargandoUbicacion || !ubicacionActual}
                  >
                    Guardar movimiento
                  </button>
                </div>
              </div>
            </div>
          )}

            <h3 style={ui.title}>{TERMINOS.movimientos}</h3>

            {puntos.length === 0 ? (
              <div style={ui.sectionCard}>
                <p style={ui.emptyState}>
                  Aún no hay movimientos registrados en esta ruta.
                </p>
              </div>
            ) : (
              <div style={ui.tableContainer}>
                <table style={ui.table}>
                  <thead>
                    <tr>
                      <th style={ui.th}>Hora</th>
                      <th style={ui.th}>Ubicación</th>
                      <th style={ui.th}>{TERMINOS.entregado}</th>
                      <th style={ui.th}>{TERMINOS.devuelto}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puntos.map((p, i) => (
                      <tr
                        key={i}
                        style={{
                          backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                        }}
                      >
                        <td style={ui.td}>
                          {p.hora ? new Date(p.hora).toLocaleTimeString() : "--:--"}
                        </td>
                        <td style={ui.td}>
                          {p.ubicacion
                            ? `${p.ubicacion.lat.toFixed(5)}, ${p.ubicacion.lng.toFixed(5)}`
                            : "Sin ubicación"}
                        </td>
                        <td style={ui.td}>{p.entregados || 0} {TERMINOS.unidad}</td>
                        <td style={ui.td}>{p.frias || 0} {TERMINOS.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Ruta;
