import { apiPost } from "./api";
export const beginSession = () => localStorage.setItem("ironcore:session", "1");
export async function endSession() { try { await apiPost("/auth/logout"); } finally { localStorage.removeItem("ironcore:session"); window.location.assign("/login"); } }
