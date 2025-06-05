export default function combineDocuments(docs: any) {
  if (!docs || docs.length === 0) {
    // Handle the case where documents is an empty array
    return []; // or any other appropriate default value or behavior
  }

  return docs.map((doc: any) => doc.content).join("\n\n");
}
