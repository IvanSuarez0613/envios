import React, { useState } from "react";
import Header from "../components/Header";
import { asignarRutaAComodin, eliminarRutaComodin } from "../firebase/rutasService";

const RutasComodin = () => {
  const [repartidor, setRepartidor] = useState("");
  const [comodin, setComodin] = useState("");
  const [mensaje, setMensaje] = useState("");

  const asignar = async () => {
    if (!repartidor || !comodin) {
      setMensaje("⚠️ Ambos campos son obligatorios.");
      return;
    }

    const exito = await asignarRutaAComodin(repartidor, comodin);
    setMensaje(exito ? "✅ Ruta asignada correctamente." : "❌ No se pudo asignar la ruta.");
  };

  const eliminar = async () => {
    if (!comodin) {
      setMensaje("⚠️ Debes ingresar el usuario comodín.");
      return;
    }

    const ok = await eliminarRutaComodin(comodin);
    setMensaje(ok ? "✅ Ruta eliminada del comodín." : "❌ No se pudo eliminar.");
  };

  const inputStyle = {
    width: "100%",
    padding: "0.7rem",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    marginTop: "0.3rem",
  };

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "1.5rem",
    maxWidth: "500px",
    width: "100%",
  };

  const btnPrimary = {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    width: "100%",
    marginTop: "1rem",
  };

  const btnDanger = {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    width: "100%",
    marginTop: "0.5rem",
  };

  return (
    <>
      <Header titulo="Gestión de Rutas Comodín" usuario="admin" />

      <div style={{ padding: "1.5rem" }}>

        {/* DESCRIPCIÓN */}
        <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
          Asigna rutas automáticamente a un repartidor comodín cuando un operador no esté disponible.
        </p>

        {/* CARD PRINCIPAL */}
        <div style={cardStyle}>

          <h3 style={{ marginTop: 0, color: "#0f172a" }}>
            Asignación de ruta
          </h3>

          {/* INPUT 1 */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontWeight: "500", color: "#334155" }}>
              Repartidor faltante
            </label>
            <input
              value={repartidor}
              onChange={e => setRepartidor(e.target.value)}
              placeholder="Ej: carlos"
              style={inputStyle}
            />
          </div>

          {/* INPUT 2 */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontWeight: "500", color: "#334155" }}>
              Usuario comodín
            </label>
            <input
              value={comodin}
              onChange={e => setComodin(e.target.value)}
              placeholder="Ej: comodin1"
              style={inputStyle}
            />
          </div>

          {/* BOTONES */}
          <button onClick={asignar} style={btnPrimary}>
            Asignar ruta
          </button>

          <button onClick={eliminar} style={btnDanger}>
            Eliminar ruta del comodín
          </button>

          {/* MENSAJE */}
          {mensaje && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.7rem",
                borderRadius: "8px",
                background: "#f1f5f9",
                color: "#334155",
                fontSize: "0.9rem",
              }}
            >
              {mensaje}
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default RutasComodin;