import { NextRequest, NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { eventBroadcaster } from '@/services/events';
import { transcribeWithLocalWhisper, transcribeWithOpenAIApi } from '@/services/typescript/extractors/podcast-asr';
import type { WhisperLocalModel, ASRStep } from '@/services/typescript/extractors/podcast-asr';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const nodeId = parseInt(id, 10);
  if (isNaN(nodeId)) {
    return NextResponse.json({ error: 'Invalid node ID' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const method: 'local' | 'api' = body.method === 'api' ? 'api' : 'local';
  const model: WhisperLocalModel = body.model === 'whisper-medium' ? 'whisper-medium' : 'whisper-small';

  const node = await nodeService.getNodeById(nodeId);
  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  const meta = node.metadata || {};

  if (!meta.audio_url) {
    return NextResponse.json({ error: 'No audio URL available for this episode' }, { status: 422 });
  }

  if (meta.transcript_status !== 'asr_pending_user') {
    return NextResponse.json(
      { error: `Unexpected transcript_status: ${meta.transcript_status}` },
      { status: 409 }
    );
  }

  // Mark as processing immediately (nodeService.updateNode also broadcasts internally)
  await nodeService.updateNode(nodeId, {
    metadata: { ...meta, transcript_status: 'asr_processing' },
  });
  eventBroadcaster.broadcast({ type: 'NODE_UPDATED', data: { nodeId } });

  // Run ASR in background — respond immediately
  setImmediate(async () => {
    try {
      // Broadcast granular step updates so the UI can show progress.
      const broadcastStep = async (step: ASRStep | 'uploading') => {
        await nodeService.updateNode(nodeId, {
          metadata: { ...meta, transcript_status: 'asr_processing', asr_step: step },
        });
        eventBroadcaster.broadcast({ type: 'NODE_UPDATED', data: { nodeId } });
      };

      let result;
      if (method === 'api') {
        await broadcastStep('uploading');
        result = await transcribeWithOpenAIApi(meta.audio_url, meta.duration_minutes);
      } else {
        result = await transcribeWithLocalWhisper(meta.audio_url, model, broadcastStep);
      }

      await nodeService.updateNode(nodeId, {
        chunk: result.transcript,
        chunk_status: 'not_chunked',
        metadata: {
          ...meta,
          transcript_status: 'available',
          transcript_source: method === 'api' ? 'whisper_api' : 'whisper_local',
          transcript_confidence: 'high',
          asr_model: result.model,
          asr_cost_usd: result.cost_usd,
        },
      });

      // Trigger embedding pipeline
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ingestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });

      eventBroadcaster.broadcast({ type: 'NODE_UPDATED', data: { nodeId } });
    } catch (err) {
      console.error(`[podcast-asr] ASR failed for node ${nodeId}:`, err);
      await nodeService.updateNode(nodeId, {
        metadata: { ...meta, transcript_status: 'asr_pending_user' },
      });
      eventBroadcaster.broadcast({ type: 'NODE_UPDATED', data: { nodeId } });
    }
  });

  return NextResponse.json({ success: true, message: 'Transcription started' });
}
