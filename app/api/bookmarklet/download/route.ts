import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const folderPath = path.join(process.cwd(), 'public', 'bookmarklet-button');

  if (!fs.existsSync(folderPath)) {
    return NextResponse.json({ error: 'Extension folder not found' }, { status: 404 });
  }

  const zip = new JSZip();
  const folder = zip.folder('bookmarklet-button')!;

  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      folder.file(file, fs.readFileSync(filePath));
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="ra-os-extension.zip"',
    },
  });
}
