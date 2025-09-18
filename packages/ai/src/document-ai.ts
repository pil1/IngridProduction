import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

const client = new DocumentProcessorServiceClient();

export async function processDocument(projectId: string, location: string, processorId: string, filePath: string) {
  // The full resource name of the processor
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  // Read the file into a buffer
  const fs = require('fs').promises;
  const imageFile = await fs.readFile(filePath);

  // Convert the image data to a Buffer
  const encodedImage = Buffer.from(imageFile).toString('base64');

  const request = {
    name,
    rawDocument: {
      content: encodedImage,
      mimeType: 'application/pdf', // Adjust mime type as per your document
    },
  };

  const [result] = await client.processDocument(request);
  const document = result.document;

  if (!document || !document.text) {
    console.log('No document text found.');
    return null;
  }

  return document.text;
}
