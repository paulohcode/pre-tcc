/**
 * Cole aqui as chaves do Firebase Console (Configurações do app > SDK).
 * Essas chaves são públicas por natureza; a proteção fica nas regras
 * do Firestore e no login do professor.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyB_2_3DeNE2fPEqonUS7HIm3HhamguNxPI",
  authDomain: "pre-banca.firebaseapp.com",
  projectId: "pre-banca",
  storageBucket: "pre-banca.firebasestorage.app",
  messagingSenderId: "34248374213",
  appId: "1:34248374213:web:28a71eaa7cd9ed7e183dac"
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey && !String(firebaseConfig.apiKey).includes("COLE_AQUI")
  );
}
