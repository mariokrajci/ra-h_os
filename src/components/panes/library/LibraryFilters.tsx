"use client";

export type LibraryFilter = 'all' | 'in_progress' | 'completed' | 'not_started';
export type LibrarySort = 'last_read' | 'title' | 'date_added';

interface LibraryFiltersProps {
  filter: LibraryFilter;
  sort: LibrarySort;
  onFilterChange: (filter: LibraryFilter) => void;
  onSortChange: (sort: LibrarySort) => void;
}

export default function LibraryFilters({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: LibraryFiltersProps) {
  const filters: LibraryFilter[] = ['all', 'in_progress', 'completed', 'not_started'];

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #1a1a1a' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {filters.map((value) => (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            style={{
              border: '1px solid #222',
              borderRadius: '999px',
              padding: '4px 10px',
              fontSize: '11px',
              color: filter === value ? '#e5e5e5' : '#777',
              background: filter === value ? '#181818' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {value.replace('_', ' ')}
          </button>
        ))}
      </div>

      <select
        value={sort}
        onChange={(event) => onSortChange(event.target.value as LibrarySort)}
        style={{ background: '#111', color: '#ccc', border: '1px solid #222', borderRadius: '6px', padding: '4px 8px', fontSize: '11px' }}
      >
        <option value="last_read">Last Read</option>
        <option value="title">Title</option>
        <option value="date_added">Date Added</option>
      </select>
    </div>
  );
}
