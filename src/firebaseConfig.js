// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

/*
const firebaseConfig = {
  apiKey: "AIzaSyCPhLDVzwBIzCzb_p-jtFs9MMOLrLiOhyA",
  authDomain: "entregatortillas.firebaseapp.com",
  databaseURL: "https://entregatortillas-default-rtdb.firebaseio.com",
  projectId: "entregatortillas",
  storageBucket: "entregatortillas.firebasestorage.app",
  messagingSenderId: "157030077209",
  appId: "1:157030077209:web:ec1c74b4fe0f5e5d52eb88",
  measurementId: "G-DBDS5W3M2B"
};*/

const firebaseConfig = {
  apiKey: "AIzaSyB8l8g4YaTS-91G4SrTQPD6SaiDj8UZcjY",
  authDomain: "enviospruebas.firebaseapp.com",
  projectId: "enviospruebas",
  storageBucket: "enviospruebas.firebasestorage.app",
  messagingSenderId: "661224748150",
  appId: "1:661224748150:web:25c3693b3f036d064e1b57",
  measurementId: "G-824ZKCL705"
};

const app = initializeApp(firebaseConfig);

// 🔁 Exportaciones correctas
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
