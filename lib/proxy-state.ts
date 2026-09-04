import { proxy } from "valtio";

interface AppState {
  email: string | null;
  activeClient: string | null;
}

export const state = proxy<AppState>({ email: null, activeClient: null });
