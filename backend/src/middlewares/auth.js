import { authMiddleware } from "./AuthMiddleware.js";

export const protect = authMiddleware;

export default protect;
