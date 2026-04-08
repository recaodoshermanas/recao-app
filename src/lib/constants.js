export const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export const MONTHS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const PAQUETERIA = ["Celeritas","Inpost","Vinted Go","UPS","Disashop","Nacex","GLS","Amazon"];
export const GASTOS_FIJOS_TPL = [
  { key: "ss", label: "Seguros Sociales" },
  { key: "alquiler", label: "Alquiler" },
  { key: "iva_alquiler", label: "IVA Alquiler" },
  { key: "luz", label: "Luz" },
  { key: "agua", label: "Agua (Emasesa)" },
  { key: "asesoria", label: "Asesoría / Gestoría" },
  { key: "securitas", label: "Securitas" },
  { key: "epos", label: "EPOS Now" },
  { key: "ayuntamiento", label: "Gasto Ayuntamiento" },
];
export const OWNER_PASSWORD = "Recao2019_";
const now = new Date();
export const currentMK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
