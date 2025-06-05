import { Request, Response } from "express";
import { Retrieval } from "../RAG/Retriever/Retriever";

export const Chat = async (req: Request, res: Response): Promise<any> => {
  const { messageText, sessionId } = req.body; // Assuming text data if not form data
  //   console.log("Received data in ChatProcessor:", data, req.body);
  //   console.log("Received data in ChatProcessor:", data.sessionId);
  console.log(messageText, sessionId);
  const response = await Retrieval(messageText, sessionId);
  console.log("response is: ", response);

  return res.status(200).json({ data: response });
};
