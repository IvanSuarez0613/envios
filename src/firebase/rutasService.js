// src/firebase/rutasService.js

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  runTransaction,   // ⬅️ nuevo
  onSnapshot,       // ⬅️ nuevo
  getDoc 
} from "firebase/firestore";
// Doc "candado" para asegurar 1 recorrido activo por usuario
const activoRef = (uid) => doc(db, "recorridos_activos", uid);
import { db } from "../firebaseConfig";

export const obtenerRutaComodin = async (comodinUid) => {
  const rutasRef = collection(db, "rutasAsignadas"); 
  const q = query(
    rutasRef,
    where("comodin", "==", comodinUid),
    orderBy("asignadoEn", "desc"),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }
  return null;
};

// 🔧 Limpia valores no permitidos por Firestore
const limpiarObjetoFirestore = (obj) => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (value === undefined || typeof value === "function" || Number.isNaN(value)) {
        return null;
      }
      return value;
    })
  );
};

// 🔍 Sanear coordenadas lat/lng
const sanitizarUbicacion = (ubicacion) => {
  if (
    !ubicacion ||
    typeof ubicacion.lat !== "number" ||
    typeof ubicacion.lng !== "number" ||
    isNaN(ubicacion.lat) ||
    isNaN(ubicacion.lng)
  ) {
    return { lat: 0, lng: 0 };
  }
  return ubicacion;
};

/**
 * ✅ Inicia un recorrido
 */
/**
 * ✅ Inicia un recorrido con candado: solo uno activo por usuario.
 * Si ya hay uno activo, NO crea otro y devuelve el existente.
 */
export const iniciarRecorrido = async (
  usuario,
  ubicacionInicial = { lat: 0, lng: 0 },
  kilosIniciales = 0
) => {
  if (!usuario) throw new Error("UID de usuario requerido");
  try {
    const result = await runTransaction(db, async (tx) => {
      const aRef = activoRef(usuario);
      const aSnap = await tx.get(aRef);

      // Ya existe uno activo → regresamos su ID
      if (aSnap.exists()) {
        return { id: aSnap.data().recorridoId, existed: true };
      }

      // Creamos el recorrido y marcamos activo
      const rRef = doc(collection(db, "recorridos"));
      tx.set(rRef, {
        usuario,
        estado: "activo",
        horaInicio: new Date().toISOString(),       // conservamos ISO para tu UI actual
        horaFin: null,
        inicioUbicacion: sanitizarUbicacion(ubicacionInicial),
        finUbicacion: null,
        kilosIniciales,
        kilosRestantes: kilosIniciales,
        duracionTotalMin: null,
        puntos: [],
        timestamp: serverTimestamp(),
        recorridoId: rRef.id
      });

      tx.set(aRef, {
        recorridoId: rRef.id,
        startedAt: serverTimestamp()
      });

      return { id: rRef.id, existed: false };
    });

    console.log(
      result.existed
        ? `⚠️ Ya había recorrido activo. Usando ID: ${result.id}`
        : `✅ Recorrido iniciado con ID: ${result.id}`
    );
    return result.id;
  } catch (error) {
    console.error("❌ Error al iniciar recorrido:", error);
    return null;
  }
};


/**
 * ✅ Finaliza un recorrido
 */
/**
 * ✅ Finaliza el recorrido y libera el candado del usuario.
 */
// reemplaza COMPLETO finalizarRecorrido en src/firebase/rutasService.js
export const finalizarRecorrido = async (recorridoId, datosFinales) => {
  try {
    if (!recorridoId) throw new Error("recorridoId requerido");

    // leemos el recorrido fuera de la transacción para obtener el usuario
    const rDoc = doc(db, "recorridos", recorridoId);
    const rSnap = await getDoc(rDoc);
    const usuario = rSnap.exists() ? rSnap.data().usuario : null;

    const limpio = limpiarObjetoFirestore({
      estado: "finalizado",
      horaFin: new Date().toISOString(),
      finUbicacion: sanitizarUbicacion(datosFinales?.finUbicacion),
      kilosRestantes: datosFinales?.kilosRestantes,
      duracionTotalMin: datosFinales?.duracionTotalMin,
      puntos: (datosFinales?.puntos || []).map((p) => ({
        ...p,
        ubicacion: sanitizarUbicacion(p.ubicacion),
      })),
    });

    await runTransaction(db, async (tx) => {
      // 🔴 PRIMERO TODOS LOS READS
      let aSnap = null;
      if (usuario) {
        const aRef = doc(db, "recorridos_activos", usuario);
        aSnap = await tx.get(aRef); // <-- read antes de cualquier write
        // luego los WRITES
        tx.update(rDoc, limpio);
        if (aSnap.exists() && aSnap.data().recorridoId === recorridoId) {
          tx.delete(aRef); // libera el candado
        }
      } else {
        // si no pudimos obtener usuario, al menos cerramos el recorrido
        tx.update(rDoc, limpio);
      }
    });

    console.log("✅ Recorrido finalizado correctamente:", recorridoId);
  } catch (error) {
    console.error("❌ Error al finalizar recorrido:", error);
  }
};


/**
 * ✅ Obtiene todos los puntos de recorridos de un usuario
 */
export const getRecorridosPorUsuario = async (username) => {
  const puntos = [];

  try {
    const ref = collection(db, "recorridos");
    const q = query(ref, where("usuario", "==", username));

    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (Array.isArray(data.puntos)) {
        data.puntos.forEach((p) => {
          if (
            p.ubicacion &&
            typeof p.ubicacion.lat === "number" &&
            typeof p.ubicacion.lng === "number"
          ) {
            puntos.push({
              hora: p.hora || null,
              ubicacion: p.ubicacion,
              entregados: p.entregados || 0,
              frias: p.frias || 0,
            });
          }
        });
      }
    });

    console.log(`📦 ${puntos.length} puntos encontrados para ${username}`);
    return puntos;
  } catch (error) {
    console.error("❌ Error al recuperar recorridos:", error);
    return [];
  }
};
/**
 * 🔁 Asigna puntos de recorrido de un repartidor al comodín
 */
export const asignarRutaAComodin = async (repartidorFaltante, comodin) => {
  try {
    const puntos = await getRecorridosPorUsuario(repartidorFaltante);

    if (!puntos.length) {
      console.warn("⚠️ No se encontraron puntos para asignar.");
      return false;
    }

    const docRef = await addDoc(collection(db, "rutasAsignadas"), {
      repartidorFaltante,
      comodin,
      puntos,
      asignadoEn: serverTimestamp(),
    });

    console.log("✅ Ruta asignada al comodín:", docRef.id);
    return true;
  } catch (err) {
    console.error("❌ Error al asignar ruta al comodín:", err);
    return false;
  }
};

export const guardarRutaComodin = async (comodin, repartidorFaltante, puntos) => {
  try {
    await addDoc(collection(db, "rutasComodin"), {
      comodin,
      repartidorFaltante,
      asignadoEn: Timestamp.now(),
      puntos,
    });
    return true;
  } catch (e) {
    console.error("❌ Error al guardar ruta comodín:", e);
    return false;
  }
};

export const eliminarRutaComodin = async (comodinUid) => {
  try {
    const rutasRef = collection(db, "rutasAsignadas");
    const q = query(
      rutasRef,
      where("comodin", "==", comodinUid),
      orderBy("asignadoEn", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      await deleteDoc(doc(db, "rutasAsignadas", docId));
      console.log("🧹 Ruta eliminada correctamente");
      return true;
    }

    console.warn("⚠️ No se encontró ruta para eliminar");
    return false;
  } catch (err) {
    console.error("❌ Error al eliminar ruta:", err);
    return false;
  }
};

/**
 * 🔄 Suscripción al recorrido activo del usuario.
 * cb recibe: string|null (recorridoId)
 */
export const onRecorridoActivo = (uid, cb, onErr) => {
  if (!uid) return () => {};
  return onSnapshot(
    activoRef(uid),
    (snap) => cb(snap.exists() ? snap.data().recorridoId : null),
    onErr
  );
};

/**
 * 📍 Lectura puntual del recorrido activo.
 */
export const getRecorridoActivo = async (uid) => {
  if (!uid) return null;
  const s = await getDoc(activoRef(uid));
  return s.exists() ? s.data().recorridoId : null;
};
