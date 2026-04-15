import { useEffect, useRef } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";

const useNotificacionRecorridos = (callback) => {
  const yaDetectados = useRef(new Set());

  useEffect(() => {
    const q = query(collection(db, "recorridos"), where("horaFin", "==", null));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ahora = Date.now();

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const docId = change.doc.id;
          const data = change.doc.data();
          const horaInicio = new Date(data.horaInicio).getTime();

          // ⚠️ Solo notificar si el recorrido es realmente nuevo (últimos 3 minutos)
          const diferenciaMin = (ahora - horaInicio) / 60000;

          if (!yaDetectados.current.has(docId) && diferenciaMin < 3) {
            yaDetectados.current.add(docId);
            callback(data, docId);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [callback]);

  return null;
};

export default useNotificacionRecorridos;
