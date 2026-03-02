/**
 * PDF/Paper content extraction for RA-H knowledge management system
 * Extracts text content from PDF files and returns formatted content
 */

// Import pdf-parse directly from lib to avoid index.js debug side effects
// (pdf-parse/index.js conditionally reads ./test/data/05-versions-space.pdf when module.parent is falsy in some bundles)
// See: node_modules/pdf-parse/index.js
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const pdf = require('pdf-parse/lib/pdf-parse.js');
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface PaperMetadata {
  title?: string;
  author?: string;
  pages: number;
  info?: any;
  text_length: number;
  filename?: string;
  file_size?: number;
  extraction_method?: string;
  renderable_pages?: number;
  page_data?: PdfPageData[];
  annotation_count?: number;
}

interface ExtractionResult {
  content: string;
  chunk: string;
  metadata: PaperMetadata;
  url: string;
}

interface BufferExtractionResult {
  content: string;
  chunk: string;
  metadata: PaperMetadata;
  filename: string;
}

type PdfJsTextItem = {
  str?: string;
  dir?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
};

type PdfMetadataInfo = Record<string, unknown>;

export interface NormalizedPdfJsTextItem {
  text: string;
  dir?: string;
  width?: number;
  height?: number;
  transform: number[];
  x: number;
  y: number;
  fontName?: string;
}

export interface NormalizedPdfJsAnnotation {
  subtype?: string;
  url?: string;
  title?: string;
  rect?: number[];
}

export interface PdfPageData {
  pageNumber: number;
  text: string;
  items: NormalizedPdfJsTextItem[];
  annotations: NormalizedPdfJsAnnotation[];
}

export function normalizePdfJsTextItem(item: PdfJsTextItem): NormalizedPdfJsTextItem {
  const transform = Array.isArray(item.transform) ? item.transform : [];

  return {
    text: typeof item.str === 'string' ? item.str : '',
    dir: item.dir,
    width: typeof item.width === 'number' ? item.width : undefined,
    height: typeof item.height === 'number' ? item.height : undefined,
    transform,
    x: typeof transform[4] === 'number' ? transform[4] : 0,
    y: typeof transform[5] === 'number' ? transform[5] : 0,
    fontName: item.fontName,
  };
}

export function normalizePdfJsAnnotation(annotation: Record<string, unknown>): NormalizedPdfJsAnnotation {
  return {
    subtype: typeof annotation.subtype === 'string' ? annotation.subtype : undefined,
    url: typeof annotation.url === 'string' ? annotation.url : undefined,
    title: typeof annotation.title === 'string' ? annotation.title : undefined,
    rect: Array.isArray(annotation.rect)
      ? annotation.rect.filter((value): value is number => typeof value === 'number')
      : undefined,
  };
}

export class PaperExtractor {
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };

  private isLikelyPdf(buffer: Buffer): boolean {
    const header = buffer.slice(0, 8).toString('utf8');
    return header.includes('%PDF');
  }

  /**
   * Clean academic PDF content to reduce citation fragments and corrupted text
   */
  private cleanAcademicContent(content: string): string {
    const lines = content.split('\n');
    const cleanedLines: string[] = [];
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip empty lines for now
      if (line.length === 0) {
        continue;
      }
      
      // Skip lines that look like headers/footers (page numbers, dates)
      if (/^[\d\s\-\/]+$/.test(line)) {
        continue;
      }
      
      // Skip lines that are just citations like "[1]" or "(Smith, 2020)"
      if (/^\[\d+\]$/.test(line) || /^\([^)]+,\s*\d{4}\)$/.test(line)) {
        continue;
      }
      
      // Skip very short lines that are likely artifacts
      if (line.length < 3) {
        continue;
      }
      
      // Skip lines that are mostly special characters (likely corrupted)
      const specialCharCount = (line.match(/[^\w\s]/g) || []).length;
      if (specialCharCount > line.length * 0.5) {
        continue;
      }
      
      cleanedLines.push(line);
    }
    
    // Combine lines into paragraphs
    const paragraphs: string[] = [];
    let currentParagraph = '';
    
    for (const line of cleanedLines) {
      // Check if line looks like it ends a sentence
      const endsWithPunctuation = /[.!?]$/.test(line);
      
      // Check if next line starts with capital or is a heading
      const looksLikeNewParagraph = /^[A-Z0-9]/.test(line) && currentParagraph.endsWith('.');
      
      if (currentParagraph.length === 0) {
        currentParagraph = line;
      } else if (looksLikeNewParagraph) {
        paragraphs.push(currentParagraph);
        currentParagraph = line;
      } else if (endsWithPunctuation) {
        currentParagraph += ' ' + line;
      } else {
        currentParagraph += ' ' + line;
      }
    }
    
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph);
    }
    
    // Filter out very short paragraphs (likely noise)
    return paragraphs.filter(p => p.length > 30).join('\n\n');
  }

  /**
   * Download PDF from URL to temporary file
   */
  private async downloadPDF(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: this.headers,
      signal: AbortSignal.timeout(60000), // 60 second timeout for PDFs
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Create temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `pdf_${Date.now()}.pdf`);
    
    // Get PDF data as buffer
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Write to temp file
    await fs.writeFile(tempFile, buffer);
    
    return tempFile;
  }

  /**
   * Extract text from PDF buffer
   */
  private async extractFromPDF(buffer: Buffer): Promise<{ text: string; metadata: PaperMetadata }> {
    try {
      return await this.extractWithPdfJs(buffer);
    } catch (error: unknown) {
      const primaryMessage = this.formatErrorMessage(error);
      console.warn('Primary pdfjs-dist extraction failed, attempting pdf-parse fallback:', primaryMessage);
      try {
        return await this.extractWithPdfParse(buffer);
      } catch (fallbackError: unknown) {
        const fallbackMessage = this.formatErrorMessage(fallbackError);
        throw new Error(`PDF parsing failed: ${primaryMessage}; fallback error: ${fallbackMessage}`);
      }
    }
  }

  private async extractWithPdfParse(buffer: Buffer): Promise<{ text: string; metadata: PaperMetadata }> {
    const data = await pdf(buffer);

    const metadata: PaperMetadata = {
      pages: data.numpages,
      info: data.info,
      text_length: data.text.length,
      extraction_method: 'typescript_pdf-parse',
      renderable_pages: data.numpages,
      annotation_count: 0,
    };

    if (data.info && data.info.Title) {
      metadata.title = data.info.Title;
    } else {
      const firstLines = data.text.split('\n').slice(0, 5);
      const possibleTitle = firstLines.find((line: string) =>
        line.length > 10 && line.length < 200 && /[A-Z]/.test(line)
      );
      if (possibleTitle) {
        metadata.title = possibleTitle.trim();
      }
    }

    if (typeof data.info?.Author === 'string') {
      metadata.author = data.info.Author;
    }

    return {
      text: data.text,
      metadata,
    };
  }

  private async extractWithPdfJs(buffer: Buffer): Promise<{ text: string; metadata: PaperMetadata }> {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfData = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: pdfData, useSystemFonts: true });
    const doc = await loadingTask.promise;

    let aggregatedText = '';
    const pageData: PdfPageData[] = [];
    let annotationCount = 0;
    for (let pageIndex = 1; pageIndex <= doc.numPages; pageIndex++) {
      const page = await doc.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const normalizedItems = (textContent.items as PdfJsTextItem[]).map(normalizePdfJsTextItem);
      const pageText = normalizedItems
        .map((item) => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      let annotations: NormalizedPdfJsAnnotation[] = [];
      try {
        const rawAnnotations = await page.getAnnotations();
        annotations = rawAnnotations.map((annotation) =>
          normalizePdfJsAnnotation(annotation as unknown as Record<string, unknown>)
        );
        annotationCount += annotations.length;
      } catch (annotationError: unknown) {
        console.warn(`pdfjs-dist annotations extraction failed for page ${pageIndex}:`, annotationError);
      }

      if (pageText) {
        aggregatedText += pageText + '\n\n';
      }

      pageData.push({
        pageNumber: pageIndex,
        text: pageText,
        items: normalizedItems,
        annotations,
      });
    }

    let info: PdfMetadataInfo = {};
    try {
      const metadata = await doc.getMetadata();
      info = (metadata?.info as PdfMetadataInfo) || {};
    } catch (metadataError: unknown) {
      console.warn('pdfjs-dist metadata extraction failed:', metadataError);
    }

    const metadata: PaperMetadata = {
      pages: doc.numPages,
      info,
      text_length: aggregatedText.length,
      extraction_method: 'typescript_pdfjs_dist',
      renderable_pages: pageData.filter((page) => page.text.length > 0).length,
      page_data: pageData,
      annotation_count: annotationCount,
    };

    const title = typeof info['Title'] === 'string' ? (info['Title'] as string) : undefined;
    if (!metadata.title && title) {
      metadata.title = title;
    }
    const author = typeof info['Author'] === 'string' ? (info['Author'] as string) : undefined;
    if (!metadata.author && author) {
      metadata.author = author;
    }

    return {
      text: aggregatedText,
      metadata,
    };
  }

  /**
   * Format content for node creation
   */
  private formatContent(metadata: PaperMetadata, text: string): string {
    const sections: string[] = [];
    
    // Add metadata section
    sections.push('## Document Information');
    
    if (metadata.title) {
      sections.push(`**Title:** ${metadata.title}`);
    }
    
    sections.push(`**Pages:** ${metadata.pages}`);
    sections.push(`**Text Length:** ${metadata.text_length} characters`);
    
    if (metadata.info) {
      if (metadata.info.Author) {
        sections.push(`**Author:** ${metadata.info.Author}`);
      }
      if (metadata.info.Creator) {
        sections.push(`**Creator:** ${metadata.info.Creator}`);
      }
      if (metadata.info.Producer) {
        sections.push(`**Producer:** ${metadata.info.Producer}`);
      }
      if (metadata.info.CreationDate) {
        sections.push(`**Creation Date:** ${metadata.info.CreationDate}`);
      }
    }
    
    sections.push('');
    
    // Add content
    sections.push('## Content');
    sections.push(text);
    
    return sections.join('\n');
  }

  /**
   * Main extraction method
   */
  async extract(url: string): Promise<ExtractionResult> {
    let tempFile: string | null = null;
    
    try {
      // Validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('Invalid URL format - must start with http:// or https://');
      }
      
      // Check if URL looks like it points to a PDF
      const urlLower = url.toLowerCase();
      if (!urlLower.includes('.pdf') && !urlLower.includes('arxiv.org')) {
        console.warn('Warning: URL does not appear to point to a PDF file');
      }
      
      // Download PDF
      tempFile = await this.downloadPDF(url);
      
      // Read PDF buffer
      const buffer = await fs.readFile(tempFile);
      
      if (!this.isLikelyPdf(buffer)) {
        const preview = buffer.slice(0, 64).toString('utf8');
        throw new Error(`Downloaded file does not appear to be a PDF (header: ${preview})`);
      }

      // Extract text and metadata
      const { text, metadata } = await this.extractFromPDF(buffer);
      
      // Clean the text
      const cleanedText = this.cleanAcademicContent(text);
      
      // Add filename to metadata
      metadata.filename = path.basename(url);
      metadata.file_size = buffer.length;
      // Mark extraction method for downstream metadata
      if (!metadata.extraction_method) {
        metadata.extraction_method = 'typescript_pdf-parse';
      }
      
      // Format content for display
      const content = this.formatContent(metadata, cleanedText);
      
      // Chunk is the cleaned text
      const chunk = cleanedText;
      
      return {
        content,
        chunk,
        metadata,
        url,
      };
      
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - PDF download took too long');
      }
      throw error;
    } finally {
      // Clean up temp file
      if (tempFile) {
        try {
          await fs.unlink(tempFile);
        } catch (cleanupError: unknown) {
          console.warn('Could not delete temp file:', tempFile, cleanupError);
        }
      }
    }
  }

  /**
   * Extract text from a PDF buffer (for file uploads)
   * @param buffer - The PDF file contents as a Buffer
   * @param filename - Optional original filename for metadata
   */
  async extractFromBuffer(buffer: Buffer, filename?: string): Promise<BufferExtractionResult> {
    // Validate PDF header
    if (!this.isLikelyPdf(buffer)) {
      const preview = buffer.slice(0, 64).toString('utf8');
      throw new Error(`File does not appear to be a valid PDF (header: ${preview.substring(0, 20)}...)`);
    }

    // Extract text and metadata using existing private method
    const { text, metadata } = await this.extractFromPDF(buffer);

    // Clean the text
    const cleanedText = this.cleanAcademicContent(text);

    // Add filename to metadata
    metadata.filename = filename || 'uploaded.pdf';
    metadata.file_size = buffer.length;
    if (!metadata.extraction_method) {
      metadata.extraction_method = 'typescript_pdf-parse';
    }

    // Format content for display
    const content = this.formatContent(metadata, cleanedText);

    return {
      content,
      chunk: cleanedText,
      metadata,
      filename: metadata.filename,
    };
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }
}

/**
 * Standalone extraction function for direct use
 */
export async function extractPaper(url: string): Promise<ExtractionResult> {
  const extractor = new PaperExtractor();
  return extractor.extract(url);
}

/**
 * CLI interface for direct execution
 */
export async function runCLI(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: paper-extract <url>');
    process.exit(1);
  }
  
  const url = args[0];
  
  try {
    const result = await extractPaper(url);
    // Output as JSON for compatibility with existing tools
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly (for testing)
if (require.main === module) {
  runCLI(process.argv.slice(2)).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
