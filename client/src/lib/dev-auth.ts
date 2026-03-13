export interface DevAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export const isDevAuthBypassEnabled = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

export function createDevAuthUser(): DevAuthUser {
  return {
    uid: import.meta.env.VITE_DEV_AUTH_USER_ID || "dev-user",
    email: import.meta.env.VITE_DEV_AUTH_EMAIL || "demo@argusvene.local",
    displayName: import.meta.env.VITE_DEV_AUTH_NAME || "Argus Demo Founder",
    photoURL: null,
  };
}
