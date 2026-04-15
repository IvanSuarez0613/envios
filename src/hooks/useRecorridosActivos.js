// src/hooks/useRecorridosActivos.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Escucha en vivo la lista de usuarios con recorrido activo.
 * Fuente de verdad: /recorridos_activos/{uid} -> { recorridoId, startedAt }
 * Devuelve [{ id: recorridoId, usuario: <uid>, horaInicio: <ISO> }]
 */
export default function useRecorridosActivos() {
  const [activos, setActivos] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "recorridos_activos"));
    const unsub = onSnapshot(q, async (snap) => {
      // Cargamos todos en paralelo para componer horaInicio ISO
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          // Preferimos startedAt; si no existe, leemos el recorrido
          let horaInicioISO =
            data?.startedAt?.toDate?.()
              ? data.startedAt.toDate().toISOString()
              : null;

          if (!horaInicioISO && data?.recorridoId) {
            try {
              const r = await getDoc(doc(db, "recorridos", data.recorridoId));
              const h = r.exists() ? r.data().horaInicio : null;
              horaInicioISO = h || new Date().toISOString();
            } catch {
              horaInicioISO = new Date().toISOString();
            }
          }

          return {
            id: data.recorridoId, // usado por el botón "Ver mapa"
            usuario: d.id,        // el docId es el uid/username
            horaInicio: horaInicioISO,
          };
        })
      );

      setActivos(rows);
    });

    return () => unsub();
  }, []);

  return activos;
}
