// This is a Chapter-Level Context Preservation solution
// the idea is to group the chunk on a relevant chapter rather than small chunks
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// Initialize Supabase and OpenAI clients outside the handler to reuse across invocations
const supabase = createClient(
  process.env.SUPABASE_URL || "if this fails is your fault ",
  process.env.SUPABASE_ANON_KEY || "if this fails is your fault "
);

const loader = new PDFLoader("./src/files/installationsbekendgørelsen.pdf", {
  //   parsedItemSeparator: "",
});
var chapterPattern = /^Kapitel\s+(\d+)\s*\n(.+?)$/gm;
const sectionPattern = /^§\s*(\d+)\.\s+(.+?)(?=(?:\r?\n)§|\r?\nKapitel|$)/gms;

const loadDocument = async () => {
  const docs = await loader.load();
  // Extract only the text content from each document
  const texts = docs.map((doc: any) => doc.pageContent);
  const chunks = parseDocument(texts);
  // console.log(texts);
  // console.log(chunks);
  const embeddedChunks = await createEmbedding(chunks);
  // console.log("embeddedChunks", embeddedChunks);
};

const createEmbedding = async (chunks: any) => {
  // const parallelEmbeddings = [];

  const embeddedChunks = await Promise.all(
    chunks.map(async (chunk: any) => {
      // Create embedding for the content
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk.content,
      });

      // Return a new object with all original fields + the embedding
      // console.log(embedding.data[0].embedding);
      // console.log(chunk);
      const { metadata, content } = chunk;
      console.log(metadata);
      const { ...rest } = metadata;
      return {
        ...rest,
        content,
        embedding: embedding.data[0].embedding, // or whatever your API returns
      };
    })
  );

  const { data, error } = await supabase
    .from("chaptercontext")
    .insert(embeddedChunks);

  if (error) {
    console.log(error);
  }
  return embeddedChunks;
};

function parseDocument(documentText: any) {
  const chapters = extractChapters(documentText);
  const chunks = [];
  // console.log("chapters returned to parse,", chapters);

  for (const chapter of chapters) {
    const sectionsInChapter = extractSectionsFromChapter(chapter);

    for (const section of sectionsInChapter) {
      const chunk = createChunkWithContext(section, chapter);
      chunks.push(chunk);
    }
  }
  // console.log("chunks", chunks[0], chunks[1], chunks[2], chunks[3]);
  return chunks;
}

function extractChapters(text: any) {
  const chapters = [];
  const textStr = Array.isArray(text) ? text.join("\n") : text;
  const chapterMatches = [...textStr.matchAll(chapterPattern)];

  for (let i = 0; i < chapterMatches.length; i++) {
    const match = chapterMatches[i];
    const nextMatch = chapterMatches[i + 1];

    const chapterNumber = parseInt(match[1], 10);
    const chapterTitle = match[2].trim();
    const startIndex = match.index;
    // default to the full length of our joined text
    const endIndex = nextMatch ? nextMatch.index : textStr.length;

    chapters.push({
      number: chapterNumber,
      title: chapterTitle,
      // SLICE THE STRING, not the array
      content: textStr.slice(startIndex, endIndex).replace(/\r\n/g, "\n"),
      startIndex,
      endIndex,
    });
  }
  // console.log(chapters);

  return chapters;
}
function extractSectionsFromChapter(chapter: any) {
  const text = chapter.content;
  // find every "§ N." header and its index in the text:
  const headers = [];
  const headerRE = /^§\s*(\d+)\./gm;
  let m;
  while ((m = headerRE.exec(text))) {
    headers.push({ num: +m[1], idx: m.index });
  }

  // now slice from each header to the next one:
  const sections = [];
  for (let i = 0; i < headers.length; i++) {
    const { num, idx } = headers[i];
    const nextIdx = i + 1 < headers.length ? headers[i + 1].idx : text.length;
    const content = text.slice(idx, nextIdx).trim();
    sections.push({
      number: num,
      content,
      chapter,
    });
  }

  // console.log("sections", sections);
  return sections;
}

function createChunkWithContext(section: any, chapter: any) {
  // Create the context prefix
  const contextPrefix = `Kapitel ${chapter.number} - ${chapter.title}`;

  // Combine context with section content
  const chunkContent = `${contextPrefix}\n\n${section.content}`;

  return {
    id: `chapter_${chapter.number}_section_${section.number}`,
    content: chunkContent, // This is what gets embedded
    metadata: {
      section: `§ ${section.number}`,
      chapter: `Kapitel ${chapter.number}`,
      chapter_title: chapter.title,
      section_number: section.number,
      chapter_number: chapter.number,
      document_type: "installationsbekendgørelsen",
      source:
        "BEK nr 1082 af 12/07/2016 BEK nr 1082 af 12/07/2016 (Gældende) Bekendtgørelse om sikkerhed for udførelse og drift af elektriske installationer",
    },
  };
}
loadDocument();
// async function splitText(text, chunkSize, chunkOverlap) {
//   console.log("inserting chunksize: ", chunkSize);
//   console.log("inserting chunkoverlap: ", chunkOverlap);
//   const splitter = new RecursiveCharacterTextSplitter({
//     chunkSize: chunkSize,
//     separators: ["\n\n", "\n", " ", ""],
//     chunkOverlap: chunkOverlap,
//   });
//   const result = await splitter.createDocuments([text]);

//   if (result.length === 0) {
//     return null;
//   }
//   return result;
// }

// const embeddingCreation = async (documents: any) => {
//   let BATCH_SIZE = 100;

//   const parallelEmbeddings = [];

//   for (let i = 0; i < documents.length; i += BATCH_SIZE) {
//     const batchDocs = documents.slice(i, i + BATCH_SIZE);
//     parallelEmbeddings.push(
//       openai.embeddings.create({
//         model: "text-embedding-3-small",
//         input: batchDocs.map((doc: any) => doc.pageContent),
//       })
//     );
//   }
//   // Run all embedding requests in parallel
//   const results = await Promise.all(parallelEmbeddings);

//   // Flatten all results into a single array of embeddings
//   const allEmbeddings = results.flatMap((result) =>
//     result.data.map((item) => item.embedding)
//   );
//   console.log("Embeddings: ", allEmbeddings);
//   // return allEmbeddings;
// };
