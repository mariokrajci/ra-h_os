import { NextRequest, NextResponse } from 'next/server';
import { annotationService } from '@/services/database';

export const runtime = 'nodejs';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const annotationId = parseInt(id, 10);
    if (isNaN(annotationId)) {
      return NextResponse.json({ success: false, error: 'Invalid annotation ID' }, { status: 400 });
    }

    const annotation = annotationService.getAnnotationById(annotationId);
    if (!annotation) {
      return NextResponse.json({ success: false, error: 'Annotation not found' }, { status: 404 });
    }

    annotationService.deleteAnnotationWithNotes(annotationId, annotation.node_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
