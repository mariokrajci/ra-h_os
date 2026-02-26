import { generateWiki } from '@/services/wiki/generate';

export const runtime = 'nodejs';

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await generateWiki((progress) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
        });

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ stage: 'complete', ...result })}\n\n`)
        );
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ stage: 'error', message: error?.message || 'Wiki generation failed' })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
