import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getFirebase, hashPin, slugifyName } from "./app.js";

const SESSION_KEY = "banca-tcc-aluno";

export function getStudentSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStudentSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStudentSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function identifyStudent(name, pin) {
  const firebase = getFirebase();
  if (!firebase) throw new Error("Firebase não configurado.");

  const trimmed = name.trim();
  const voterId = slugifyName(trimmed);
  if (!voterId) throw new Error("Selecione o seu nome.");
  if (!/^\d{4}$/.test(pin)) throw new Error("O PIN deve ter 4 dígitos numéricos.");

  const pinHash = await hashPin(trimmed, pin);
  const ref = doc(firebase.db, "voters", voterId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      name: trimmed,
      pinHash,
      createdAt: serverTimestamp(),
    });
  } else if (snap.data().pinHash !== pinHash) {
    throw new Error("PIN incorreto para este nome.");
  }

  const session = { voterId, name: snap.exists() ? snap.data().name : trimmed };
  saveStudentSession(session);
  return session;
}

export function isTeamMember(project, studentName) {
  const target = slugifyName(studentName);
  return (project.students || []).some((n) => slugifyName(n) === target);
}

export async function hasVoted(voterId, projectId) {
  const firebase = getFirebase();
  if (!firebase) return false;
  const snap = await getDoc(doc(firebase.db, "votes", `${voterId}_${projectId}`));
  return snap.exists();
}
