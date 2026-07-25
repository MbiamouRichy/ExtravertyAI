import { proxy } from "valtio";

export const state = proxy({ email: "string" });
