"use client";

import { Node } from '@/types/database';
import { getNodeIcon } from '@/utils/nodeIcons';
import { useDimensionIcons } from '@/context/DimensionIconsContext';

interface ListViewProps {
  nodes: Node[];
  onNodeClick: (nodeId: number) => void;
}

export default function ListView({ nodes, onNodeClick }: ListViewProps) {
  const { dimensionIcons } = useDimensionIcons();
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const truncateContent = (content?: string, maxLength: number = 100) => {
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
      padding: '8px'
    }}>
      {nodes.map(node => (
          <button
            key={node.id}
            onClick={() => onNodeClick(node.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px',
              marginBottom: '4px',
              background: 'var(--app-panel-elevated)',
              border: '1px solid var(--app-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--app-hover)';
              e.currentTarget.style.borderColor = 'var(--app-toolbar-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--app-panel-elevated)';
              e.currentTarget.style.borderColor = 'var(--app-border)';
            }}
          >
            {/* Icon */}
            <div style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--app-surface-subtle)',
              borderRadius: '6px',
              flexShrink: 0
            }}>
              {getNodeIcon(node, dimensionIcons, 16)}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title */}
              <div style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--app-text)',
                marginBottom: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {node.title || 'Untitled'}
              </div>

              {/* Description or Content Preview */}
              {(node.description || node.notes) && (
                <div style={{
                  fontSize: '12px',
                  color: 'var(--app-text-muted)',
                  marginBottom: '8px',
                  lineHeight: '1.4',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {node.description || truncateContent(node.notes)}
                </div>
              )}

              {/* Metadata Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                {/* Dimensions */}
                {node.dimensions && node.dimensions.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    flexWrap: 'wrap'
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

                {/* Date */}
                <span style={{
                  fontSize: '10px',
                  color: 'var(--app-text-subtle)'
                }}>
                  {formatDate(node.updated_at || node.created_at)}
                </span>

                {/* Edge count */}
                {node.edge_count !== undefined && node.edge_count > 0 && (
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--app-text-subtle)'
                  }}>
                    {node.edge_count} connections
                  </span>
                )}
              </div>
            </div>
          </button>
      ))}
    </div>
  );
}
