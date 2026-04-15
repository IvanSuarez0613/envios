import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline} from "react-leaflet";
import { getRutaConCalles } from "../utils/routing";
import L from "leaflet";
import { db } from "../firebaseConfig";
import { collection, query, where, onSnapshot} from "firebase/firestore";

const motoIcon = new L.Icon({
  iconUrl: "/icons/moto.png",
  iconSize: [50, 50],
  iconAnchor: [25, 25],
});

// Normaliza un punto a { ubicacion: {lat, lng}, nombre?, id? }
function normalizePoint(p) {
  const lat = p?.ubicacion?.lat ?? p?.lat;
  const lng = p?.ubicacion?.lng ?? p?.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    return p.ubicacion ? p : { ...p, ubicacion: { lat, lng } };
  }
  return null;
}

// Compara arrays de puntos por contenido (lat/lng + id opcional)
function samePoints(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const A = a[i]?.ubicacion, B = b[i]?.ubicacion;
    if (!A || !B) return false;
    if (A.lat !== B.lat || A.lng !== B.lng) return false;
    // Si quieres ser más estricto podrías comparar también ids
    // const idA = a[i]?.id ?? null; const idB = b[i]?.id ?? null;
    // if (idA !== idB) return false;
  }
  return true;
}


const RutaComodinMapa = ({ comodinUid, puntos: puntosProp }) => {
  const [rutaCoords, setRutaCoords] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // ¿Llegan puntos manuales?
  const hasPuntosProp = useMemo(
    () => Array.isArray(puntosProp) && puntosProp.length > 0,
    [puntosProp]
  );

  // Hash por CONTENIDO de puntosProp (evita que el efecto dependa de la referencia)
  const puntosHash = useMemo(() => {
    if (!hasPuntosProp) return null;
    // Solo serializamos lo necesario para detectar cambios reales
    const base = puntosProp
      .map(p => {
        const n = normalizePoint(p);
        if (!n) return null;
        return {
          lat: n.ubicacion.lat,
          lng: n.ubicacion.lng,
          id: n.id ?? undefined,
          nombre: n.nombre ?? undefined,
        };
      })
      .filter(Boolean);
    return JSON.stringify(base);
  }, [hasPuntosProp, puntosProp]);

  // Guardar/limpiar la suscripción activa de Firestore
  const unsubscribeRef = useRef(null);

  /** ---------------------------------------------------------
   * Efecto 1 — Solo procesa puntosProp por CONTENIDO (puntosHash)
   * --------------------------------------------------------- */
  useEffect(() => {
    if (!hasPuntosProp) return;

    // Normaliza a estructura consistente
    const validos = puntosProp
      .map(normalizePoint)
      .filter(Boolean);

    // Evita setState si nada cambió realmente
    if (!samePoints(validos, puntos)) {
      // Si había una suscripción previa (por si venías de Firestore), límpiala
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setRutaCoords([]);
      setPuntos(validos);
    }
    // Ya tenemos puntosProp, no hay carga remota
    if (cargando) setCargando(false);

    // Dependemos de puntosHash (contenido) y de hasPuntosProp
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPuntosProp, puntosHash]); // <- NO dependemos de puntosProp directamente

  /** ----------------------------------------------------------------
   * Efecto 2 — Suscripción a Firestore (solo si NO hay puntosProp)
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (hasPuntosProp) return; // Si hay puntos manuales, no nos suscribimos

    if (!comodinUid) {
      console.warn("⚠️ No hay comodinUid ni puntos manuales. No se muestra el mapa.");
      setPuntos([]);
      setRutaCoords([]);
      setRepartidorFaltante(null);
      setCargando(false);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    // Limpia suscripción previa si existía (cambio de comodinUid)
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setCargando(true);
    const qRef = query(collection(db, "rutasAsignadas"), where("comodin", "==", comodinUid));

    const unsub = onSnapshot(qRef, async (snapshot) => {
      // Evitar alternar cargando true/false en exceso: solo si cambia algo
      let mustStopLoading = false;

      if (snapshot.empty) {
      if (puntos.length !== 0) setPuntos([]);
      if (rutaCoords.length !== 0) setRutaCoords([]);
      if (repartidorFaltante !== null) setRepartidorFaltante(null);
      mustStopLoading = true;
        if (mustStopLoading && cargando) setCargando(false);
        return;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      if (!data?.puntos || data.puntos.length === 0) {
      if (puntos.length !== 0) setPuntos([]);
      if (rutaCoords.length !== 0) setRutaCoords([]);
      if (repartidorFaltante !== null) setRepartidorFaltante(null);
      mustStopLoading = true;
        if (mustStopLoading && cargando) setCargando(false);
        return;
      }

      const puntosValidos = data.puntos
        .map(normalizePoint)
        .filter(Boolean);

      if (!samePoints(puntosValidos, puntos)) {
        setPuntos(puntosValidos);
      }

      try {
        const geojson = await getRutaConCalles(
          puntosValidos.map((p) => ({ ubicacion: p.ubicacion }))
        );
        const coords =
          geojson?.features?.[0]?.geometry?.coordinates?.map(
            ([lng, lat]) => [lat, lng]
          ) ?? [];
        // Evita setState si no cambió
        const changedLen = coords.length !== rutaCoords.length;
        let changedCoords = changedLen;
        if (!changedLen) {
          for (let i = 0; i < coords.length; i++) {
            if (coords[i][0] !== rutaCoords[i][0] || coords[i][1] !== rutaCoords[i][1]) {
              changedCoords = true;
              break;
            }
          }
        }
        if (changedCoords) setRutaCoords(coords);
      } finally {
        if (cargando) setCargando(false);
      }
    });

    unsubscribeRef.current = unsub;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPuntosProp, comodinUid]); // <- NO dependas de puntosProp aquí

  /** ----------------------------------------------------------------
   * Efecto 3 — Cargar tiendas del repartidor original (si NO hay puntosProp)
   * ---------------------------------------------------------------- */

  /** ----------------------------------------------------------------
   * Render
   * ---------------------------------------------------------------- */
  if (cargando) {
      return (
        <div style={{ padding: "1rem", color: "#64748b" }}>
          Cargando mapa...
        </div>
      );
    }

    if (!Array.isArray(puntos) || puntos.length === 0) {
      return (
        <div
          style={{
            padding: "1rem",
            border: "1px dashed #cbd5e1",
            borderRadius: "12px",
            color: "#64748b",
            background: "#f8fafc",
          }}
        >
          No hay puntos disponibles para mostrar en el mapa.
        </div>
      );
    }

    const primeraUbicacion = puntos[0]?.ubicacion;

    if (
      !primeraUbicacion ||
      typeof primeraUbicacion.lat !== "number" ||
      typeof primeraUbicacion.lng !== "number"
    ) {
      return (
        <div
          style={{
            padding: "1rem",
            border: "1px dashed #fecaca",
            borderRadius: "12px",
            color: "#991b1b",
            background: "#fff5f5",
          }}
        >
          La ubicación inicial no es válida.
        </div>
      );
    }

    return (
      <MapContainer
        center={[primeraUbicacion.lat, primeraUbicacion.lng]}
        zoom={15}
        style={{
          height: "320px",
          width: "100%",
          borderRadius: "12px",
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />

        {rutaCoords.length > 0 && <Polyline positions={rutaCoords} color="blue" />}

        {puntos.map((p, i) => (
          <Marker
            key={i}
            position={[p.ubicacion.lat, p.ubicacion.lng]}
            icon={motoIcon}
          />
        ))}
      </MapContainer>
    );
};

export default RutaComodinMapa;
