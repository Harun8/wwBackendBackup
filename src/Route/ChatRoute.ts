import express from "express";
import { Chat } from "../Controller/ChatController";
const router = express.Router();

router.route("/chat").post(Chat);

export default router;
