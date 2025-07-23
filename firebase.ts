import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAzMt6osJCeyoDCot_JdZX7DPP1oVqDxQE",
  authDomain: "herboristerie-la-fee-des-bois.firebaseapp.com",
  projectId: "herboristerie-la-fee-des-bois",
  storageBucket: "herboristerie-la-fee-des-bois.appspot.com",
  messagingSenderId: "436423464469",
  appId: "1:436423464469:web:d8768084f28b8cccf5e01c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});
export const isFirebaseConfigured = !!firebaseConfig.apiKey;
