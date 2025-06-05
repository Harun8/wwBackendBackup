import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PassThrough } from "stream";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { answerTemplate, standaloneQuestionPrompt } from "../Prompt/Prompts";
import combineDocuments from "../../utils/combineDoc";
// import combineDocuments from "@/util/combineDocuments";
// import formatConvHistory from "@/util/formatConvHistory";
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
import dotenv from "dotenv";
dotenv.config();

const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    config: {
      broadcast: { ack: true },
    },
  }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // api key
});

let uuid = crypto.randomUUID();

let channelB;

export async function Retrieval(messageText: string, sessionId: Number) {
  try {
    console.log(messageText, sessionId);
    channelB = client.channel(`session-${sessionId}`); // change so client sends it

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4.1-nano",
      streaming: true,
      //  temperature: 0.5
    });

    const standaloneQuestionchain = standaloneQuestionPrompt
      .pipe(llm)
      .pipe(new StringOutputParser());

    const retrieverChain = RunnableSequence.from([
      (prevResult) => messageText,
      (prevResult) => retriever(prevResult),
      combineDocuments,
    ]);

    const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser());

    const chain = RunnableSequence.from([
      {
        standalone_question: standaloneQuestionchain,
        original_input: new RunnablePassthrough(),
      },
      {
        context: retrieverChain,
        question: ({ original_input }) => original_input.question,
        conv_history: ({ original_input }) => [],
      },
      answerChain,
    ]);

    const response = await chain.invoke({
      question: messageText, // comes from the client
      conv_history: [],
    });

    // for await (const chunk of response) {
    //   //   console.log(response);
    //   await channelB.send({
    //     type: "broadcast",
    //     event: "acknowledge",
    //     payload: { message: chunk },
    //   });
    // }
    return response;
    // client.removeChannel(channelB);
  } catch (error) {
    console.error("error", error);
  }
}

// async function processData(data) {
//   try {
//     channelB = client.channel(`session-${data.sessionId}`);

//     const llm = new ChatOpenAI({
//       openAIApiKey: process.env.OPENAI_API_KEY,
//       modelName: modelChooser(data.plan),
//       streaming: true,
//       //  temperature: 0.5
//     });

//     const standaloneQuestionchain = standaloneQuestionPrompt
//       .pipe(llm)
//       .pipe(new StringOutputParser());

//     const retrieverChain = RunnableSequence.from([
//       (prevResult) => prevResult.standalone_question,
//       (prevResult) => retriver(prevResult, data.file_id),
//       combineDocuments,
//     ]);

//     const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser());

//     const chain = RunnableSequence.from([
//       {
//         standalone_question: standaloneQuestionchain,
//         original_input: new RunnablePassthrough(),
//       },
//       {
//         context: retrieverChain,
//         question: ({ original_input }) => original_input.question,
//         conv_history: ({ original_input }) => original_input.conv_history,
//       },
//       answerChain,
//     ]);

//     const response = await chain.stream({
//       question: data.messageText,
//       conv_history: await formatConvHistory(data.conv_history),
//     });

//     for await (const chunk of response) {
//       await channelB.send({
//         type: "broadcast",
//         event: "acknowledge",
//         payload: { message: chunk },
//       });
//     }
//     client.removeChannel(channelB);
//   } catch (error) {
//     console.error(error.message);
//     channelB.send({
//       type: "broadcast",
//       event: "acknowledge",
//       payload: { message: error },
//     });

//     client.removeChannel(channelB);
//   }
// }

async function retriever(queryText: any) {
  const model = "text-embedding-3-small";
  // Generate the embedding vector for the query text
  let queryEmbedding;
  console.log("queryText", queryText);
  try {
    const embeddingResult = await openai.embeddings.create({
      model: model,
      input: queryText,
    });
    if (embeddingResult.error) {
      console.error("Error generating embeddings:", embeddingResult.error);
      return [];
    }
    queryEmbedding = embeddingResult.data[0].embedding; // Adjust this line based on the actual structure of the response
  } catch (error) {
    console.error("Error during embedding generation:", error);
    return [];
  }
  // Now use the generated embedding as query_embedding in the RPC call
  const { data, error } = await supabase.rpc("match_chapter_context", {
    query_embedding: queryEmbedding,
    match_count: 5,
    p_document_type: null,
    p_source: null,
  });

  if (error) {
    console.error("Error searching for documents:", error);
    return [];
  }

  //   console.log(data);

  return data || [];
}
