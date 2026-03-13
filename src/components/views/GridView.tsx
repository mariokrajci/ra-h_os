"use client";

import { Node } from '@/types/database';
import { getNodeIcon } from '@/utils/nodeIcons';
import { useDimensionIcons } from '@/context/DimensionIconsContext';

interface GridViewProps {
  nodes: Node[];
  onNodeClick: (nodeId: number) => void;
}

export default function GridView({ nodes, onNodeClick }: GridViewProps) {
  const { dimensionIcons } = useDimensionIcons();
  const truncateContent = (content?: string, maxLength: number = 120) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (nodes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--app-text-muted)',
        fontSize: '13px'
      }}>
        No nodes match the current filters
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '12px'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '12px'
      }}>
        {nodes.map(node => (
            <button
              key={node.id}
              onClick={() => onNodeClick(node.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '16px',
                background: 'var(--app-panel-elevated)',
                border: '1px solid var(--app-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                minHeight: '140px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--app-hover)';
                e.currentTarget.style.borderColor = 'var(--app-toolbar-border)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--app-panel-elevated)';
                e.currentTarget.style.borderColor = 'var(--app-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Header with Icon */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '10px'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--app-surface-subtle)',
                  borderRadius: '6px',
                  flexShrink: 0
                }}>
                  {getNodeIcon(node, dimensionIcons, 14)}
                </div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--app-text)',
                  lineHeight: '1.3',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {node.title || 'Untitled'}
                </div>
              </div>

              {/* Description or Content Preview */}
              {(node.description || node.notes) && (
                <div style={{
                  flex: 1,
                  fontSize: '11px',
                  color: 'var(--app-text-muted)',
                  lineHeight: '1.5',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  marginBottom: '10px'
                }}>
                  {node.description || truncateContent(node.notes)}
                </div>
              )}

              {/* Footer with Dimensions */}
              {node.dimensions && node.dimensions.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  flexWrap: 'wrap',
                  marginTop: 'auto'
                }}>
                  {node.dimensions.slice(0, 3).map(dim => (
                    <span
                      key={dim}
                      style={{
                        padding: '2px 6px',
                        background: 'var(--app-accent-soft)',
                        borderRadius: '3px',
                        fontSize: '10px',
                        color: 'var(--toolbar-accent)'
                      }}
                    >
                      {dim}
                    </span>
                  ))}
                  {node.dimensions.length > 3 && (
                    <span style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      color: 'var(--app-text-subtle)'
                    }}>
                      +{node.dimensions.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
        ))}
      </div>
    </div>
  );
}
