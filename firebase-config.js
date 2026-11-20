// ARSLAN LISTAS — configuración PÚBLICA de Firebase, proyecto NUEVO y exclusivo.
// Igual que Ruta Madrid: Firebase Authentication + Realtime Database.
// No usar la configuración de RUTA1 ni sus credenciales, base de datos o workspace.
// Los valores de configuración web de Firebase no son credenciales administrativas;
// la protección de pedidos depende de las reglas de Realtime Database.
const ARSLAN_FIREBASE_CONFIG = Object.freeze({
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  projectId: '',
  appId: ''
});
const ARSLAN_FIREBASE_WORKSPACE = 'arslan-listas-next-v1';
const ARSLAN_CLOUD_ACTIVE = Boolean(
  ARSLAN_FIREBASE_CONFIG.apiKey && ARSLAN_FIREBASE_CONFIG.authDomain &&
  ARSLAN_FIREBASE_CONFIG.databaseURL && ARSLAN_FIREBASE_CONFIG.projectId &&
  ARSLAN_FIREBASE_CONFIG.appId
);