// src/utils/routing.js
import axios from "axios";

// 🔑 Tu propia API Key de OpenRouteService
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjNmMDA5NTg5NGE3YjRiNDc4MzFiOWZjNmZkZjhkNWMwIiwiaCI6Im11cm11cjY0In0=";

export const getRutaConCalles = async (puntos) => {
  const coordinates = puntos.map(p => {
    if (p.ubicacion) return [p.ubicacion.lng, p.ubicacion.lat];
    return [p.lng, p.lat];
  });

  const body = {
    coordinates,
    format: "geojson"
  };

  try {
    const response = await axios.post(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      body,
      {
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error("❌ Error al obtener ruta:", error);
    return null;
  }
};
