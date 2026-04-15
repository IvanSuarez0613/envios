import { useEffect, useMemo, useRef, useState } from "react";
import {
  getRepartidores,
  getTiendasByRepartidorPage,
  streamTiendasByRepartidorFirstPage,
} from "../firebase/tiendasService";
import Modal from "react-modal";
import Header from "../components/Header";
import MapaRutaComodin from "../components/RutaComodinMapa";
import "../styles/RutaComodin.css"; // reutilizamos los mismos estilos que usas en comodín

Modal.setAppElement("#root");

const PAGE_SIZE = 25;

// Normaliza distintos formatos de ubicación: {lat,lng} ó GeoPoint {latitude,longitude} ó strings
const toCoords = (ubicacion) => {
  if (!ubicacion) return null;
  let lat =
    ubicacion.lat ??
    ubicacion.latitude ??
    ubicacion._lat ??
    ubicacion.y ??
    null;
  let lng =
    ubicacion.lng ??
    ubicacion.longitude ??
    ubicacion._long ??
    ubicacion.x ??
    null;

  if (typeof lat === "string") lat = parseFloat(lat.trim());
  if (typeof lng === "string") lng = parseFloat(lng.trim());
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
  ) {
    return { lat, lng };
  }
  return null;
};

export default function ConsultarTiendas() {
  const [repartidores, setRepartidores] = useState([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [tiendas, setTiendas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [endCursor, setEndCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const unsubRef = useRef(null);

  // UI (igual que RutaComodin)
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(null);
  const [imagenModal, setImagenModal] = useState(null);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);

  useEffect(() => {
    (async () => {
      const list = await getRepartidores();
      setRepartidores(list);
      if (!selectedUid && list.length) setSelectedUid(list[0].uid);
    })();
  }, []);

  // Primera página en vivo
  useEffect(() => {
    if (!selectedUid) return;
    setLoading(true);
    setTiendas([]);
    setEndCursor(null);
    setHasMore(false);
    if (unsubRef.current) unsubRef.current();

    unsubRef.current = streamTiendasByRepartidorFirstPage(
      selectedUid,
      PAGE_SIZE,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTiendas(rows);
        setEndCursor(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.size === PAGE_SIZE);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubRef.current && unsubRef.current();
  }, [selectedUid]);

  // Página siguiente
  const loadMore = async () => {
    if (!selectedUid || !endCursor) return;
    setLoading(true);
    const { docs, lastDoc } = await getTiendasByRepartidorPage(
      selectedUid,
      PAGE_SIZE,
      endCursor
    );
    const rows = docs.map((d) => ({ id: d.id, ...d.data() }));
    setTiendas((prev) => [...prev, ...rows]);
    setEndCursor(lastDoc ?? null);
    setHasMore(docs.length === PAGE_SIZE);
    setLoading(false);
  };

  // Export CSV
  const exportCSV = () => {
    const header = [
      "id",
      "nombre",
      "calle",
      "numero",
      "colonia",
      "municipio",
      "estado",
      "cp",
      "colorFachada",
      "referencias",
      "fechaRegistro",
      "lat",
      "lng",
      "fotoURL",
      "repartidorUid",
    ];
    const lines = tiendas.map((t) => {
      const d = t.direccion || {};
      const ts = t.fechaRegistro?.seconds
        ? new Date(t.fechaRegistro.seconds * 1000).toISOString()
        : "";
      const c = toCoords(t.ubicacion) || {};
      const foto = t.fotoURL || t.imagen || "";
      return [
        t.id,
        t.nombre || "",
        d.calle || "",
        d.numero || "",
        d.colonia || "",
        d.municipio || "",
        d.estado || "",
        d.cp || "",
        t.colorFachada || "",
        t.referencias || d.referencias || "",
        ts,
        c.lat ?? "",
        c.lng ?? "",
        foto,
        t.repartidorUid || "",
      ]
        .map((v) => `"${String(v).replaceAll(`"`, `""`)}"`)
        .join(",");
    });
    const blob = new Blob(
      [header.join(",") + "\n" + lines.join("\n")],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiendas_${selectedUid}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  

const title = useMemo(() => {
    const r = repartidores.find((r) => r.uid === selectedUid);
    return r ? `Red de clientes – ${r.nombre}` : "Red de clientes";
  }, [repartidores, selectedUid]);

  // Helpers UI
  const abrirImagen = (img) => setImagenModal(img);
  const cerrarImagen = () => setImagenModal(null);
  const abrirMapa = (coords) => setUbicacionSeleccionada(coords);
  const cerrarMapa = () => setUbicacionSeleccionada(null);

  return (
  <>
    <Header titulo="Red de Clientes" usuario="admin" />

    <div className="p-4 max-w-7xl mx-auto">

      {/* TITULO */}
      <h2 style={{ margin: 0, color: "#0f172a" }}>
        {title}
      </h2>

      <p style={{ color: "#64748b", marginTop: "0.4rem" }}>
        Visualiza clientes, ubicación y evidencia operativa.
      </p>

      {/* CONTROLES */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "1rem",
          marginTop: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Repartidor
          </label>

          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            style={{
              width: "100%",
              padding: "0.7rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              marginTop: "0.3rem",
              background: "#f8fafc",
            }}
          >
            {repartidores.map((r) => (
              <option key={r.uid} value={r.uid}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={exportCSV}
          disabled={!tiendas.length}
          style={{
            background: tiendas.length ? "#0f172a" : "#94a3b8",
            color: "#fff",
            border: "none",
            padding: "0.75rem 1.2rem",
            borderRadius: "8px",
            cursor: tiendas.length ? "pointer" : "not-allowed",
            height: "fit-content",
          }}
        >
          Exportar datos
        </button>
      </div>

      {/* LISTA */}
      <div className="lista-tiendas">
        <h3>📋 Lista de Tiendas:</h3>

        {tiendas.length === 0 && !loading && (
          <div className="text-gray-500">Sin tiendas</div>
        )}

        {tiendas.map((t, index) => {
          const dir = t.direccion || {};
          const foto = t.fotoURL || t.imagen || "";
          const coords = toCoords(t.ubicacion);

          return (
            <div key={t.id || index} className="item-tienda">

              {/* BOTÓN */}
              <button
                className="btn-colapsar"
                onClick={() =>
                  setTiendaSeleccionada(
                    index === tiendaSeleccionada ? null : index
                  )
                }
              >
                🏪 {t.nombre || `Punto ${index + 1}`}
              </button>

              {/* DETALLE */}
              {index === tiendaSeleccionada && (
                <div
                  className="info-tienda"
                  style={{
                    background: "#f8fafc",
                    borderRadius: "10px",
                    padding: "1rem",
                    border: "1px solid #e2e8f0",
                    marginTop: "0.5rem",
                  }}
                >
                  <p><strong>Nombre:</strong> {t.nombre || "Sin nombre"}</p>

                  <div style={{ marginBottom: "0.5rem" }}>
                    <span
                      style={{
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                      }}
                    >
                      Activo
                    </span>
                  </div>

                  <p><strong>Color fachada:</strong> {t.colorFachada || "-"}</p>

                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong style={{ color: "#0f172a" }}>Ubicación:</strong>
                    <div style={{ color: "#475569", fontSize: "0.9rem" }}>
                      {dir.calle || "-"}, {dir.colonia || "-"}, #{dir.numero || "-"}
                    </div>
                  </div>

                  <p><strong>Referencias:</strong> {t.referencias || dir.referencias || "-"}</p>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button
                      onClick={() => abrirImagen(foto)}
                      disabled={!foto}
                      style={{
                        background: "#3b82f6",
                        color: "#fff",
                        border: "none",
                        padding: "0.5rem 0.8rem",
                        borderRadius: "6px",
                        cursor: foto ? "pointer" : "not-allowed",
                      }}
                    >
                      📷 Ver imagen
                    </button>

                    {coords ? (
                      <button
                        onClick={() => abrirMapa(coords)}
                        style={{
                          background: "#f59e0b",
                          color: "#fff",
                          border: "none",
                          padding: "0.5rem 0.8rem",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        📍 Ver ubicación
                      </button>
                    ) : (
                      <span style={{ color: "red", fontSize: "0.8rem" }}>
                        Sin coordenadas
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PAGINACIÓN */}
      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={loadMore}
          disabled={!hasMore || loading}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "0.5rem 1rem",
            cursor: "pointer",
          }}
        >
          {loading ? "Cargando…" : hasMore ? "Cargar más" : "No hay más"}
        </button>
      </div>

      {/* MODAL IMAGEN */}
      <Modal
        isOpen={!!imagenModal}
        onRequestClose={cerrarImagen}
      >
        <button onClick={cerrarImagen}>✖ Cerrar</button>
        {imagenModal && <img src={imagenModal} alt="Tienda" />}
      </Modal>

      {/* MODAL MAPA */}
      <Modal
        isOpen={!!ubicacionSeleccionada}
        onRequestClose={cerrarMapa}
      >
        <button onClick={cerrarMapa}>✖ Cerrar</button>
        {ubicacionSeleccionada && (
          <MapaRutaComodin puntos={[ubicacionSeleccionada]} />
        )}
      </Modal>

    </div>
  </>
);
}
