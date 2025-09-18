import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    // Ensure the upload directory exists
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = Date.now() + '-' + file.name;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    return NextResponse.json({ success: true, filePath: `/uploads/${filename}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'File upload failed' });
  }
}