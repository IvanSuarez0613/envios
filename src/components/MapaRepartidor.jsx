import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { getRutaConCalles } from "../utils/routing";

const motoIcon = new L.Icon({
  iconUrl: "/icons/moto.png",
  iconSize: [50, 50],
  iconAnchor: [25, 25],
  className: "animated-moto", // para rotación dinámica
});

const SeguidorMapa = ({ ubicacion }) => {
  const map = useMap();
  useEffect(() => {
    if (ubicacion) {
      map.setView([ubicacion.lat, ubicacion.lng], 16, { animate: true });
    }
  }, [ubicacion]);
  return null;
};

const MapaRepartidor = ({ recorridoId }) => {
  const markerRef = useRef(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [rutaCoords, setRutaCoords] = useState([]);
  const ultimaUbicacionRef = useRef(null);

  useEffect(() => {
    if (!recorridoId) return;

    const ref = doc(db, "recorridos", recorridoId);

    const unsubscribe = onSnapshot(ref, async (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      const puntos = [
        ...(data.inicioUbicacion ? [data.inicioUbicacion] : []),
        ...(data.puntos ? data.puntos.map(p => p.ubicacion) : [])
      ];

      const ult = puntos[puntos.length - 1];
      if (ult) setUbicacion(ult);

      if (puntos.length >= 2) {
        try {
          const res = await getRutaConCalles(puntos.map(p => ({ ubicacion: p })));
          if (res?.features?.[0]?.geometry?.coordinates) {
            const coords = res.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            setRutaCoords(coords);
          }
        } catch (err) {
          console.error("❌ Error obteniendo ruta ORS:", err);
        }
      }
    });

    return () => unsubscribe();
  }, [recorridoId]);

  // ANIMACIÓN SUAVE + ROTACIÓN
  useEffect(() => {
    if (!ubicacion || !markerRef.current) return;

    const marker = markerRef.current;
    const el = marker.getElement?.() || marker._icon;
    const start = ultimaUbicacionRef.current || marker.getLatLng();
    const end = L.latLng(ubicacion.lat, ubicacion.lng);

    const latStep = (end.lat - start.lat) / 30;
    const lngStep = (end.lng - start.lng) / 30;

    let i = 0;
    let frame;

    const deltaLat = end.lat - start.lat;
    const deltaLng = end.lng - start.lng;
    const angle = Math.atan2(deltaLng, deltaLat) * (180 / Math.PI);
    if (el) el.style.transform = `rotate(${angle}deg)`;

    const animate = () => {
      i++;
      const newLat = start.lat + latStep * i;
      const newLng = start.lng + lngStep * i;
      marker.setLatLng([newLat, newLng]);

      if (i < 30) {
        frame = requestAnimationFrame(animate);
      }
    };

    animate();
    ultimaUbicacionRef.current = end;

    return () => cancelAnimationFrame(frame);
  }, [ubicacion]);

  if (!ubicacion) return <p>⏳ Esperando ubicación en tiempo real...</p>;

  return (
    <MapContainer
      center={[ubicacion.lat, ubicacion.lng]}
      zoom={16}
      style={{ height: "400px", width: "100%", borderRadius: "10px" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <SeguidorMapa ubicacion={ubicacion} />
      <Marker
        icon={motoIcon}
        position={[ubicacion.lat, ubicacion.lng]}
        ref={(ref) => {
          if (ref) markerRef.current = ref;
        }}
      />
      {rutaCoords.length > 0 && <Polyline positions={rutaCoords} color="blue" />}
    </MapContainer>
  );
};

export default MapaRepartidor;
