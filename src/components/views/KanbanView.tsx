"use client";

import { useState, DragEvent } from 'react';
import { Plus, GripVertical, X } from 'lucide-react';
import { Node } from '@/types/database';
import { KanbanColumn } from '@/types/views';

interface KanbanViewProps {
  nodes: Node[];
  columns: KanbanColumn[];
  dimensions: string[];
  onNodeClick: (nodeId: number) => void;
  onColumnChange: (columns: KanbanColumn[]) => void;
  onNodeDimensionUpdate: (nodeId: number, newDimension: string, oldDimension?: string) => void;
}

export default function KanbanView({
  nodes,
  columns,
  dimensions,
  onNodeClick,
  onColumnChange,
  onNodeDimensionUpdate
}: KanbanViewProps) {
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
  const [draggedFromColumn, setDraggedFromColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Get nodes for a specific column (dimension)
  const getNodesForColumn = (dimension: string) => {
    return nodes.filter(node => node.dimensions?.includes(dimension));
  };

  // Get uncategorized nodes (not in any column)
  const getUncategorizedNodes = () => {
    const columnDimensions = columns.map(c => c.dimension);
    return nodes.filter(node =>
      !node.dimensions || !node.dimensions.some(d => columnDimensions.includes(d))
    );
  };

  const handleAddColumn = (dimension: string) => {
    const newColumn: KanbanColumn = {
      id: `col-${Date.now()}`,
      dimension,
      order: columns.length
    };
    onColumnChange([...columns, newColumn]);
    setShowColumnPicker(false);
    setSearchQuery('');
  };

  const handleRemoveColumn = (columnId: string) => {
    onColumnChange(columns.filter(c => c.id !== columnId));
  };

  // Node drag handlers
  const handleNodeDragStart = (e: DragEvent, nodeId: number, fromColumn: string) => {
    setDraggedNodeId(nodeId);
    setDraggedFromColumn(fromColumn);
    e.dataTransfer.effectAllowed = 'copyMove';

    // Find the node to get its title for chat drop
    const node = nodes.find(n => n.id === nodeId);
    const title = node?.title || 'Untitled';

    // Set MIME types for chat input drops
    e.dataTransfer.setData('application/x-rah-node', JSON.stringify({ id: nodeId, title }));
    e.dataTransfer.setData('application/node-info', JSON.stringify({ id: nodeId, title, dimensions: node?.dimensions || [] }));
    e.dataTransfer.setData('text/plain', `[NODE:${nodeId}:"${title}"]`);
  };

  const handleNodeDragEnd = () => {
    setDraggedNodeId(null);
    setDraggedFromColumn(null);
    setDragOverColumn(null);
  };

  const handleColumnDragOver = (e: DragEvent, columnDimension: string) => {
    e.preventDefault();
    if (draggedNodeId !== null) {
      setDragOverColumn(columnDimension);
    }
  };

  const handleColumnDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleColumnDrop = (e: DragEvent, targetDimension: string) => {
    e.preventDefault();
    if (draggedNodeId !== null && draggedFromColumn !== targetDimension) {
      onNodeDimensionUpdate(
        draggedNodeId,
        targetDimension,
        draggedFromColumn || undefined
      );
    }
    handleNodeDragEnd();
  };

  // Column reorder drag handlers
  const handleColumnDragStart = (e: DragEvent, columnId: string) => {
    setDraggingColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragEnd = () => {
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };

  const handleColumnReorderDragOver = (e: DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggingColumnId && draggingColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleColumnReorderDrop = (e: DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!draggingColumnId || draggingColumnId === targetColumnId) return;

    const newColumns = [...columns];
    const dragIndex = newColumns.findIndex(c => c.id === draggingColumnId);
    const dropIndex = newColumns.findIndex(c => c.id === targetColumnId);

    if (dragIndex !== -1 && dropIndex !== -1) {
      const [removed] = newColumns.splice(dragIndex, 1);
      newColumns.splice(dropIndex, 0, removed);
      // Update order values
      newColumns.forEach((col, idx) => { col.order = idx; });
      onColumnChange(newColumns);
    }

    handleColumnDragEnd();
  };

  const filteredDimensions = dimensions.filter(d =>
    d.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !columns.some(c => c.dimension === d)
  );

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent'
    }}>
      {/* Column Setup Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--app-border)',
        background: 'var(--app-surface-strong)',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>
          Columns:
        </span>

        {columns.length === 0 && (
          <span style={{ fontSize: '11px', color: 'var(--app-text-subtle)', fontStyle: 'italic' }}>
            Add dimensions to create columns
          </span>
        )}

        {/* Add Column Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: 'var(--app-panel-elevated)',
              border: '1px solid var(--app-border)',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--app-text-muted)',
              cursor: 'pointer'
            }}
          >
            <Plus size={12} />
            Add Column
          </button>

          {/* Dimension Picker */}
          {showColumnPicker && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              width: '200px',
              maxHeight: '300px',
              background: 'var(--app-panel-elevated)',
              border: '1px solid var(--app-border)',
              borderRadius: '6px',
              overflow: 'hidden',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              <input
                type="text"
                placeholder="Search dimensions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--app-input)',
                  border: 'none',
                  borderBottom: '1px solid var(--app-border)',
                  color: 'var(--app-text)',
                  fontSize: '12px',
                  outline: 'none'
                }}
                autoFocus
              />
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {filteredDimensions.length === 0 ? (
                  <div style={{
                    padding: '12px',
                    fontSize: '12px',
                    color: 'var(--app-text-muted)',
                    textAlign: 'center'
                  }}>
                    No dimensions available
                  </div>
                ) : (
                  filteredDimensions.map(dim => (
                    <button
                      key={dim}
                      onClick={() => handleAddColumn(dim)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--app-text)',
                        fontSize: '12px',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--app-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {dim}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Click outside to close */}
        {showColumnPicker && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setShowColumnPicker(false)}
          />
        )}
      </div>

      {/* Kanban Board */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '12px',
        padding: '12px',
        overflowX: 'auto',
        overflowY: 'hidden'
      }}>
        {sortedColumns.map(column => {
          const columnNodes = getNodesForColumn(column.dimension);
          const isDropTarget = dragOverColumn === column.dimension && draggedFromColumn !== column.dimension;
          const isReorderTarget = dragOverColumnId === column.id;

          return (
            <div
              key={column.id}
              style={{
                width: '280px',
                minWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                background: isDropTarget ? 'var(--app-accent-soft)' : 'var(--app-panel)',
                border: isReorderTarget ? '2px dashed var(--toolbar-accent)' : '1px solid var(--app-border)',
                borderRadius: '8px',
                transition: 'all 0.2s'
              }}
              onDragOver={(e) => handleColumnDragOver(e, column.dimension)}
              onDragLeave={handleColumnDragLeave}
              onDrop={(e) => handleColumnDrop(e, column.dimension)}
            >
              {/* Column Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--app-border)',
                  cursor: 'grab'
                }}
                draggable
                onDragStart={(e) => handleColumnDragStart(e, column.id)}
                onDragEnd={handleColumnDragEnd}
                onDragOver={(e) => handleColumnReorderDragOver(e, column.id)}
                onDrop={(e) => handleColumnReorderDrop(e, column.id)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <GripVertical size={14} color="var(--app-text-subtle)" />
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--app-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {column.dimension}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--app-text-muted)',
                    background: 'var(--app-surface-subtle)',
                    padding: '2px 6px',
                    borderRadius: '10px'
                  }}>
                    {columnNodes.length}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveColumn(column.id)}
                  style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--app-text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Column Content */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px'
              }}>
                {columnNodes.map(node => (
                  <div
                    key={node.id}
                    draggable
                    onDragStart={(e) => handleNodeDragStart(e, node.id, column.dimension)}
                    onDragEnd={handleNodeDragEnd}
                    onClick={() => onNodeClick(node.id)}
                    style={{
                      padding: '10px',
                      marginBottom: '6px',
                      background: draggedNodeId === node.id ? 'var(--app-surface-subtle)' : 'var(--app-panel-elevated)',
                      border: '1px solid var(--app-border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      opacity: draggedNodeId === node.id ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (draggedNodeId !== node.id) {
                        e.currentTarget.style.background = 'var(--app-hover)';
                        e.currentTarget.style.borderColor = 'var(--app-toolbar-border)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (draggedNodeId !== node.id) {
                        e.currentTarget.style.background = 'var(--app-panel-elevated)';
                        e.currentTarget.style.borderColor = 'var(--app-border)';
                      }
                    }}
                  >
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--app-text)',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {node.title || 'Untitled'}
                    </div>
                    {node.dimensions && node.dimensions.length > 1 && (
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        flexWrap: 'wrap',
                        marginTop: '6px'
                      }}>
                        {node.dimensions
                          .filter(d => d !== column.dimension)
                          .slice(0, 2)
                          .map(dim => (
                            <span
                              key={dim}
                              style={{
                                padding: '2px 6px',
                                background: 'var(--app-surface-subtle)',
                                borderRadius: '3px',
                                fontSize: '10px',
                                color: 'var(--app-text-muted)'
                              }}
                            >
                              {dim}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}

                {columnNodes.length === 0 && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--app-text-subtle)',
                    fontSize: '11px'
                  }}>
                    Drop nodes here
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Uncategorized Column (if nodes exist without column dimensions) */}
        {columns.length > 0 && getUncategorizedNodes().length > 0 && (
          <div
            style={{
              width: '280px',
              minWidth: '280px',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--app-panel)',
              border: '1px dashed var(--app-border)',
              borderRadius: '8px'
            }}
          >
            <div style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--app-border)'
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--app-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Uncategorized ({getUncategorizedNodes().length})
              </span>
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px'
            }}>
              {getUncategorizedNodes().map(node => (
                <div
                  key={node.id}
                  draggable
                  onDragStart={(e) => handleNodeDragStart(e, node.id, '__uncategorized__')}
                  onDragEnd={handleNodeDragEnd}
                  onClick={() => onNodeClick(node.id)}
                  style={{
                    padding: '10px',
                    marginBottom: '6px',
                    background: 'var(--app-panel-elevated)',
                    border: '1px solid var(--app-border)',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--app-text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {node.title || 'Untitled'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {columns.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--app-text-muted)',
            fontSize: '13px'
          }}>
            Add dimension columns to organize your nodes
          </div>
        )}
      </div>
    </div>
  );
}
