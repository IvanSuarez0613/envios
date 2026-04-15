import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { obtenerRutaComodin } from "../firebase/rutasService";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const TiendasAsignadas = ({ comodinUid }) => {
  const [tiendas, setTiendas] = useState([]);
  const [repartidorAsignado, setRepartidorAsignado] = useState(null);
  const [verImagen, setVerImagen] = useState(null);
  const [verUbicacion, setVerUbicacion] = useState(null);

  useEffect(() => {
    const fetchTiendas = async () => {
      const ruta = await obtenerRutaComodin(comodinUid);
      if (!ruta || !ruta.repartidorFaltante) return;

      setRepartidorAsignado(ruta.repartidorFaltante);

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
  }, [comodinUid]);

  if (!repartidorAsignado) return <p>📭 No hay tiendas asignadas.</p>;

  return (
    <div style={{ padding: "1rem" }}>
      <h3>🏪 Tiendas del repartidor: <b>{repartidorAsignado}</b></h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
        {tiendas.map((tienda) => (
          <div key={tienda.id} style={{ border: "1px solid #ccc", borderRadius: "10px", padding: "1rem", background: "#f9f9f9" }}>
            <h4>{tienda.nombre || "Sin nombre"}</h4>
            <p><b>Color fachada:</b> {tienda.colorFachada}</p>
            <p><b>Calle:</b> {tienda.calle} #{tienda.numero}</p>
            <p><b>Colonia:</b> {tienda.colonia}</p>
            <p><b>Referencias:</b> {tienda.referencias}</p>

            <div style={{ marginTop: "0.5rem" }}>
              <button onClick={() => setVerImagen(tienda.id)}>🖼️ Ver imagen</button>
              <button onClick={() => setVerUbicacion(tienda.id)}>📍 Ver ubicación</button>
            </div>

            {verImagen === tienda.id && tienda.fotoURL && (
              <div style={{ marginTop: "1rem" }}>
                <img src={tienda.fotoURL} alt="Tienda" style={{ width: "100%", borderRadius: "8px" }} />
              </div>
            )}

            {verUbicacion === tienda.id && tienda.ubicacion && (
              <div style={{ marginTop: "1rem", height: "200px" }}>
                <MapContainer
                  center={[tienda.ubicacion.lat, tienda.ubicacion.lng]}
                  zoom={17}
                  style={{ height: "100%", width: "100%", borderRadius: "8px" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[tienda.ubicacion.lat, tienda.ubicacion.lng]}>
                    <Popup>{tienda.nombre}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TiendasAsignadas;
