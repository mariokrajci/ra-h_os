"use client";

import { useState } from 'react';
import { X, Filter, ChevronDown } from 'lucide-react';
import { ViewFilter } from '@/types/views';

interface ViewFiltersProps {
  filters: ViewFilter[];
  filterLogic: 'and' | 'or';
  dimensions: string[];
  flags: Array<{ name: string; color: string }>;
  onFilterChange: (filters: ViewFilter[]) => void;
  onFilterLogicChange: (logic: 'and' | 'or') => void;
}

export default function ViewFilters({
  filters,
  filterLogic,
  dimensions,
  flags,
  onFilterChange,
  onFilterLogicChange
}: ViewFiltersProps) {
  const [showDimensionPicker, setShowDimensionPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddFilter = (value: string, type: 'dimension' | 'flag' = 'dimension') => {
    if (!filters.some(f => f.dimension === value && (f.type ?? 'dimension') === type)) {
      onFilterChange([...filters, { dimension: value, operator: 'includes', type }]);
    }
    setShowDimensionPicker(false);
    setSearchQuery('');
  };

  const handleRemoveFilter = (dimension: string, type: 'dimension' | 'flag' = 'dimension') => {
    onFilterChange(filters.filter(f => !(f.dimension === dimension && (f.type ?? 'dimension') === type)));
  };

  const handleToggleOperator = (dimension: string, type: 'dimension' | 'flag' = 'dimension') => {
    onFilterChange(filters.map(f =>
      f.dimension === dimension && (f.type ?? 'dimension') === type
        ? { ...f, operator: f.operator === 'includes' ? 'excludes' : 'includes' }
        : f
    ));
  };

  const filteredDimensions = dimensions.filter(d =>
    d.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !filters.some(f => f.dimension === d && (f.type ?? 'dimension') === 'dimension')
  );

  const filteredFlags = flags.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !filters.some(fi => fi.dimension === f.name && fi.type === 'flag')
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderBottom: '1px solid var(--app-border)',
      background: 'var(--app-surface-strong)',
      flexWrap: 'wrap',
      minHeight: '40px'
    }}>
      <span style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>
        Filters:
      </span>

      {/* Add Filter Button — pinned left */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowDimensionPicker(!showDimensionPicker)}
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
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Filter size={12} />
          Filter
        </button>

        {/* Picker Dropdown */}
        {showDimensionPicker && (
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
              placeholder="Search..."
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
              {filteredDimensions.length === 0 && filteredFlags.length === 0 ? (
                <div style={{
                  padding: '12px',
                  fontSize: '12px',
                  color: 'var(--app-text-muted)',
                  textAlign: 'center'
                }}>
                  No filters found
                </div>
              ) : (
                <>
                  {filteredDimensions.length > 0 && (
                    <>
                      <div style={{ padding: '4px 12px 2px', fontSize: '10px', color: 'var(--app-text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Dimensions
                      </div>
                      {filteredDimensions.map(dim => (
                        <button
                          key={dim}
                          onClick={() => handleAddFilter(dim, 'dimension')}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--app-text)',
                            fontSize: '12px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--app-hover)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {dim}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredFlags.length > 0 && (
                    <>
                      <div style={{ padding: '4px 12px 2px', fontSize: '10px', color: 'var(--app-text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Flags
                      </div>
                      {filteredFlags.map(flag => (
                        <button
                          key={flag.name}
                          onClick={() => handleAddFilter(flag.name, 'flag')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--app-text)',
                            fontSize: '12px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--app-hover)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: flag.color, display: 'inline-block', flexShrink: 0 }} />
                          {flag.name}
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter Chips */}
      {filters.map(filter => {
        const isFlag = filter.type === 'flag';
        const flagColor = isFlag ? flags.find(f => f.name === filter.dimension)?.color : undefined;
        return (
          <div
            key={`${filter.type ?? 'dimension'}-${filter.dimension}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: filter.operator === 'includes'
                ? (isFlag ? `${flagColor ?? '#6b7280'}22` : 'var(--app-accent-soft)')
                : 'var(--app-danger-bg)',
              border: `1px solid ${filter.operator === 'includes'
                ? (isFlag ? (flagColor ?? 'var(--app-accent-border)') : 'var(--app-accent-border)')
                : 'var(--app-danger-border)'}`,
              borderRadius: '4px',
              fontSize: '11px',
              color: filter.operator === 'includes'
                ? (isFlag ? (flagColor ?? 'var(--toolbar-accent)') : 'var(--toolbar-accent)')
                : 'var(--app-danger-text)'
            }}
          >
            <button
              onClick={() => handleToggleOperator(filter.dimension, filter.type ?? 'dimension')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 2px',
                cursor: 'pointer',
                color: 'inherit',
                fontSize: '10px',
                opacity: 0.7
              }}
              title={filter.operator === 'includes' ? 'Click to exclude' : 'Click to include'}
            >
              {filter.operator === 'includes' ? '+' : '-'}
            </button>
            <span>{filter.dimension}</span>
            <button
              onClick={() => handleRemoveFilter(filter.dimension, filter.type ?? 'dimension')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* Logic Toggle */}
      {filters.length > 1 && (
        <button
          onClick={() => onFilterLogicChange(filterLogic === 'and' ? 'or' : 'and')}
          style={{
            padding: '4px 8px',
            background: 'var(--app-panel-elevated)',
            border: '1px solid var(--app-border)',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            color: filterLogic === 'and' ? 'var(--toolbar-accent)' : 'var(--app-info-text)',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
          title={filterLogic === 'and' ? 'Match ALL filters' : 'Match ANY filter'}
        >
          {filterLogic}
        </button>
      )}

      {/* Click outside to close */}
      {showDimensionPicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99
          }}
          onClick={() => setShowDimensionPicker(false)}
        />
      )}
    </div>
  );
}
