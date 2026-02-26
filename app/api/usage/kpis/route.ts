import { NextRequest, NextResponse } from 'next/server';
import { SQLiteClient } from '@/services/database/sqlite-client';

export const runtime = 'nodejs';

type RangeKey = '24h' | '7d' | '30d';

const RANGE_TO_SQLITE_MODIFIER: Record<RangeKey, string> = {
  '24h': '-1 day',
  '7d': '-7 days',
  '30d': '-30 days',
};

function parseRange(value: string | null): RangeKey {
  if (!value) return '24h';
  if (value === '24h' || value === '7d' || value === '30d') return value;
  return '24h';
}

export async function GET(request: NextRequest) {
  try {
    const range = parseRange(request.nextUrl.searchParams.get('range'));
    const db = SQLiteClient.getInstance();
    const sinceModifier = RANGE_TO_SQLITE_MODIFIER[range];

    const summary = db.query<{
      total_cost_usd: number | null;
      total_tokens: number | null;
      action_count: number | null;
      avg_cost_per_action: number | null;
    }>(
      `
      SELECT
        COALESCE(SUM(CAST(estimated_cost_usd AS REAL)), 0) AS total_cost_usd,
        COALESCE(SUM(CAST(total_tokens AS INTEGER)), 0) AS total_tokens,
        COUNT(*) AS action_count,
        COALESCE(AVG(CAST(estimated_cost_usd AS REAL)), 0) AS avg_cost_per_action
      FROM ai_usage
      WHERE 1 = 1
        AND julianday(created_at) >= julianday('now', ?)
      `,
      [sinceModifier]
    ).rows[0];

    const byModel = db.query<{
      model: string | null;
      cost_usd: number | null;
      tokens: number | null;
      action_count: number | null;
    }>(
      `
      SELECT
        COALESCE(model, 'unknown') AS model,
        COALESCE(SUM(CAST(estimated_cost_usd AS REAL)), 0) AS cost_usd,
        COALESCE(SUM(CAST(total_tokens AS INTEGER)), 0) AS tokens,
        COUNT(*) AS action_count
      FROM ai_usage
      WHERE 1 = 1
        AND julianday(created_at) >= julianday('now', ?)
      GROUP BY COALESCE(model, 'unknown')
      ORDER BY cost_usd DESC
      `,
      [sinceModifier]
    ).rows;

    return NextResponse.json({
      success: true,
      data: {
        range,
        totalCostUsd: Number(summary?.total_cost_usd ?? 0),
        totalTokens: Number(summary?.total_tokens ?? 0),
        actionCount: Number(summary?.action_count ?? 0),
        avgCostPerActionUsd: Number(summary?.avg_cost_per_action ?? 0),
        byModel: byModel.map((row) => ({
          model: row.model || 'unknown',
          costUsd: Number(row.cost_usd ?? 0),
          tokens: Number(row.tokens ?? 0),
          actionCount: Number(row.action_count ?? 0),
        })),
      },
    });
  } catch (error) {
    console.error('Failed to load usage KPIs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load usage KPIs' },
      { status: 500 }
    );
  }
}
