import { Router } from "express";
import {
  registerUser,
  userLogin,
  userLogout,
  refreshToken,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(userLogin);

// secure Routes
router.route("/logout").post(verifyJWT, userLogout);
router.route("/refresh-token").post(refreshToken);

export default router;
