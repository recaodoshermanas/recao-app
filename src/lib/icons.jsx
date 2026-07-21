const S = ({ size = 20, color = "currentColor", sw = 2, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

export const IcoCheck = (p) => <S {...p}><path d="M20 6 9 17l-5-5" /></S>;
export const IcoRight = (p) => <S {...p}><path d="m9 18 6-6-6-6" /></S>;
export const IcoLeft = (p) => <S {...p}><path d="m15 18-6-6 6-6" /></S>;
export const IcoCalendar = (p) => <S {...p}><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></S>;
export const IcoSun = (p) => <S {...p}><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" /></S>;
export const IcoReceipt = (p) => <S {...p}><path d="M6 2.5h9l4 4v15H6z" /><path d="M9 9h7M9 13h7M9 17h4" /></S>;
export const IcoUser = (p) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></S>;
export const IcoBars = (p) => <S {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></S>;
export const IcoUsers = (p) => <S {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><circle cx="17.5" cy="9" r="2.6" /><path d="M15.5 15.2c3 .3 5.5 1.8 5.5 4.8" /></S>;
