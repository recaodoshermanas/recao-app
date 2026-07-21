import { UsuariosView } from "./UsuariosView.jsx";

// La antigua pantalla de Ajustes gestionaba usuarios con RPCs (crear_usuario,
// listar_usuarios, ...) que se revocaron en el cutover de seguridad. La gestion
// de usuarios vive ahora en UsuariosView (via edge function gestion-usuarios),
// asi que Ajustes la reutiliza.
export function AjustesView({ currentUser }) {
  return <UsuariosView currentUser={currentUser} />;
}
