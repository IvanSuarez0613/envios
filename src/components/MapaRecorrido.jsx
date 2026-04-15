import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import { db } from "../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import { getRutaConCalles } from "../utils/routing"; 

// Fix para íconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MapaRecorrido = ({ recorridoId, mini = false }) => {
  const [recorrido, setRecorrido] = useState(null);
  const [rutaGeoJson, setRutaGeoJson] = useState(null); 

  useEffect(() => {
    if (!recorridoId) return;

    const ref = doc(db, "recorridos", recorridoId);
    const unsubscribe = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        setRecorrido(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [recorridoId]);

  useEffect(() => {
    if (!recorrido) return;

    const puntosCompletos = [
      {
        ubicacion: recorrido.inicioUbicacion,
        entregados: 0,
        frias: 0,
        hora: recorrido.horaInicio,
        esInicio: true,
      },
      ...(recorrido.puntos || []),
    ];

    if (puntosCompletos.length >= 2) {
      getRutaConCalles(puntosCompletos).then((geojson) => {
        if (geojson) setRutaGeoJson(geojson);
      });
    }
  }, [recorrido]);

  if (!recorrido) return <p>Cargando recorrido...</p>;

  const puntosCompletos = [
    {
      ubicacion: recorrido.inicioUbicacion,
      entregados: 0,
      frias: 0,
      hora: recorrido.horaInicio,
      esInicio: true,
    },
    ...(recorrido.puntos || []),
  ];

  const coordenadas = puntosCompletos.map((p) => [p.ubicacion.lat, p.ubicacion.lng]);
  const center = coordenadas[0];

  if (!center) return <p>Ubicación no disponible aún.</p>;

  return (
    <MapContainer
      center={center}
      zoom={mini ? 13 : 15}
      scrollWheelZoom={!mini}
      dragging={!mini ? true : false}
      style={{
        height: mini ? "150px" : "400px",
        width: "100%",
        marginTop: mini ? "0.5rem" : "1rem",
        border: mini ? "1px solid #ccc" : "2px solid #444",
        borderRadius: "8px",
        filter: mini ? "grayscale(60%) brightness(1.1)" : "none",
        pointerEvents: mini ? "none" : "auto",
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {puntosCompletos.map((p, i) => (
        <Marker key={i} position={[p.ubicacion.lat, p.ubicacion.lng]}>
          {!mini && (
            <Popup>
              {p.esInicio ? "Inicio del recorrido" : `Entrega #${i}`}
              <br />
              {p.entregados} kg / Frías: {p.frias}
            </Popup>
          )}
        </Marker>
      ))}

      {rutaGeoJson && (
        <Polyline
          positions={rutaGeoJson.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])}
          color="blue"
        />
      )}
    </MapContainer>
  );
};

export default MapaRecorrido;
