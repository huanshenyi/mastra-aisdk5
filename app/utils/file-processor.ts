import { pdf } from "pdf-parse";
import officeParser from "officeparser";
import { pdf2img } from "@pdfme/converter";

export type ProcessedFile = {
  type: 'text';
  text: string;
} | {
  type: 'image';
  image: string;
} | {
  type: 'images';
  images: Array<{
    data: string;
    mimeType: string;
  }>;
  metadata: {
    pageCount: number;
    filename: string;
  };
};

/**
 * Process uploaded files and convert them to AI-readable formats
 * - Images: pass through as-is
 * - PDFs: convert each page to PNG image
 * - PowerPoint: extract text content
 */
export async function processFile(file: {
  filename: string;
  mediaType: string;
  url: string;
}): Promise<ProcessedFile> {
  const { filename, mediaType, url } = file;

  // Handle images - pass through as-is (no base64 parsing needed)
  if (mediaType.startsWith('image/')) {
    return {
      type: 'image',
      image: url,
    };
  }

  // For PDF and PowerPoint, extract base64 data from data URL
  const base64Match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error(`Invalid data URL for file: ${filename}. Expected data URL format.`);
  }

  const [, , base64Data] = base64Match;
  const buffer = Buffer.from(base64Data, 'base64');

  // Handle PDFs - convert to images using @pdfme/converter
  if (mediaType === 'application/pdf') {
    try {
      // First, get the page count
      const data = await pdf(buffer);
      const pageCount = data.pages.length;
      // console.log(`PDF ${filename} has ${pageCount} pages`);

      // Check page limit
      if (pageCount > 20) {
        // console.log(`PDF too large (${pageCount} pages), rejecting`);
        return {
          type: 'text',
          text: `[Error: PDF file "${filename}" is too large (${pageCount} pages). Please upload PDFs with 20 pages or fewer.]`,
        };
      }

      // Convert PDF to images using @pdfme/converter
      // console.log(`Converting PDF to images (${pageCount} pages)`);
      const imageBuffers = await pdf2img(buffer, {
        imageType: 'png',
      });

      // Convert image buffers to base64 data URLs
      const images = imageBuffers.map((imgBuffer) => {
        const base64 = Buffer.from(imgBuffer).toString('base64');
        return {
          data: `data:image/png;base64,${base64}`,
          mimeType: 'image/png',
        };
      });

      // console.log(`Successfully converted ${images.length} pages to images`);
      return {
        type: 'images',
        images,
        metadata: {
          pageCount,
          filename,
        },
      };
    } catch (error) {
      console.error('Error processing PDF:', error);
      return {
        type: 'text',
        text: `[Error: Could not process PDF file ${filename}. ${error instanceof Error ? error.message : 'Unknown error'}]`,
      };
    }
  }

  // Handle PowerPoint files
  if (
    mediaType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mediaType === 'application/vnd.ms-powerpoint'
  ) {
    try {
      const text = await officeParser.parseOfficeAsync(buffer);
      return {
        type: 'text',
        text: `[PowerPoint: ${filename}]\n\n${text}`,
      };
    } catch (error) {
      console.error('Error parsing PowerPoint:', error);
      return {
        type: 'text',
        text: `[Error: Could not parse PowerPoint file ${filename}]`,
      };
    }
  }

  // Unsupported file type
  return {
    type: 'text',
    text: `[Unsupported file type: ${filename} (${mediaType})]`,
  };
}
