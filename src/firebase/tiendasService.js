import {
    collection,
    getDocs,
    query,
    where,
    onSnapshot,
    limit,
    startAfter,
  } from "firebase/firestore";
  import { db } from "../firebaseConfig";
  
  /**
   * Todas las tiendas de un repartidor (consulta simple).
   */
  export const getTiendasPorRepartidor = async (repartidorUid) => {
    const tiendas = [];
    if (!repartidorUid) {
      console.warn("⚠️ Repartidor UID vacío");
      return tiendas;
    }
    try {
      const ref = collection(db, "tiendas");
      const q = query(ref, where("repartidorUid", "==", repartidorUid));
      const snapshot = await getDocs(q);
  
      snapshot.forEach((doc) => {
        const data = doc.data();
        tiendas.push({
          id: doc.id,
          nombre: data.nombre || "",
          colorFachada: data.colorFachada || "",
          calle: data.direccion?.calle || "",
          colonia: data.direccion?.colonia || "",
          numero: data.direccion?.numero || "",
          referencias: data.direccion?.referencias || data.referencias || "",
          imagen: data.fotoURL || "",
          ubicacion: data.ubicacion || null,
        });
      });
  
      console.log(`✅ ${tiendas.length} tiendas cargadas para repartidor: ${repartidorUid}`);
      return tiendas;
    } catch (error) {
      console.error("❌ Error al obtener tiendas:", error);
      return [];
    }
  };
  
  /**
   * Repartidores (colección 'users' con role: 'repartidor').
   */
  export const getRepartidores = async () => {
    try {
      // 1) Primero intenta en /users por roles típicos de tu app
      const refUsers = collection(db, "users");
      const qUsers = query(refUsers, where("role", "in", ["user", "repartidor"]));
      const snapUsers = await getDocs(qUsers);
  
      let lista = [];
      snapUsers.forEach((d) => {
        lista.push({
          uid: d.id,
          nombre: d.get("displayName") || d.get("nombre") || d.id,
          activo: d.get("activo") ?? true,
        });
      });
  
      if (lista.length) {
        lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
        console.log(`✅ Repartidores desde /users: ${lista.length}`);
        return lista;
      }
  
      // 2) Fallback: dedúcelo desde /tiendas (por si no tienes /users legible)
      const refTiendas = collection(db, "tiendas");
      const snapTiendas = await getDocs(refTiendas); // si son muchas, pon un limit() temporal
      const uids = new Set();
      snapTiendas.forEach((d) => {
        const uid = d.get("repartidorUid");
        if (uid) uids.add(uid);
      });
  
      const deducidos = Array.from(uids).map((uid) => ({
        uid,
        nombre: uid,   // si no hay /users, mostramos el UID como nombre
        activo: true,
      }));
  
      deducidos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      console.warn("⚠️ Usando fallback desde /tiendas (no se hallaron /users legibles)");
      return deducidos;
    } catch (e) {
      console.error("❌ Error al obtener repartidores:", e);
      return [];
    }
  };
  
  
  /**
   * 🔴 Realtime primera página (NOMBRES EXACTOS que espera tu vista).
   * Nota: sin orderBy para evitar índice. Pagina por __name__ (id de doc).
   */
  export const streamTiendasByRepartidorFirstPage = (
    repartidorUid,
    pageSize,
    onNext,
    onError
  ) => {
    if (!repartidorUid) return () => {};
    const ref = collection(db, "tiendas");
    const q = query(
      ref,
      where("repartidorUid", "==", repartidorUid),
      limit(pageSize)
    );
    return onSnapshot(q, onNext, onError);
  };
  
  /**
   * Página siguiente (por cursor de documento).
   */
  export const getTiendasByRepartidorPage = async (
    repartidorUid,
    pageSize,
    endCursor
  ) => {
    if (!repartidorUid || !endCursor) return { docs: [], lastDoc: null };
    const ref = collection(db, "tiendas");
    const q = query(
      ref,
      where("repartidorUid", "==", repartidorUid),
      startAfter(endCursor),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    return {
      docs: snap.docs,
      lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    };
  };
  
  /**
   * (Opcional) Alias simple si en otro lado usas este nombre.
   */
  export const suscribirTiendasPorRepartidor = (repartidorUid, onNext, onError) =>
    streamTiendasByRepartidorFirstPage(repartidorUid, 50, onNext, onError);
  