// src/pages/AsignarRuta.jsx
import React, { useState } from "react";
import { getRecorridosPorUsuario, guardarRutaComodin } from "../firebase/rutasService";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

const AsignarRuta = () => {
  const [usuarioFaltante, setUsuarioFaltante] = useState("");
  const [usuarioComodin, setUsuarioComodin] = useState("");
  const [puntos, setPuntos] = useState([]);

  const buscarRuta = async () => {
    if (!usuarioFaltante) return alert("⚠️ Escribe el nombre del repartidor que faltó");

    const puntosRecuperados = await getRecorridosPorUsuario(usuarioFaltante);
    if (puntosRecuperados.length === 0) return alert("❌ No se encontraron puntos");

    setPuntos(puntosRecuperados);
  };

  const asignarRuta = async () => {
    if (!usuarioComodin) return alert("⚠️ Escribe el nombre del comodín");

    const exito = await guardarRutaComodin(usuarioComodin, usuarioFaltante, puntos);
    alert(exito ? "✅ Ruta asignada al comodín correctamente" : "❌ Error al asignar ruta");
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>📦 Asignar Ruta de Repartidor Ausente</h2>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Nombre del repartidor ausente"
          value={usuarioFaltante}
          onChange={(e) => setUsuarioFaltante(e.target.value)}
          style={{ marginRight: "1rem" }}
        />
        <button onClick={buscarRuta}>🔍 Buscar ruta</button>
      </div>

      {puntos.length > 0 && (
        <>
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Nombre del comodín"
              value={usuarioComodin}
              onChange={(e) => setUsuarioComodin(e.target.value)}
              style={{ marginRight: "1rem" }}
            />
            <button onClick={asignarRuta}>✅ Asignar esta ruta al comodín</button>
          </div>

          <MapContainer center={puntos[0].ubicacion} zoom={14} style={{ height: "500px" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {puntos.map((p, i) => (
              <Marker key={i} position={p.ubicacion}>
                <Popup>
                  {new Date(p.hora).toLocaleString()}<br />
                  Entregados: {p.entregados} kg<br />
                  Frías: {p.frias} kg
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </>
      )}
    </div>
  );
};

export default AsignarRuta;
