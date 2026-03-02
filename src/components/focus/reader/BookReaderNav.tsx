"use client";

export interface ReaderNavItem {
  id: string;
  label: string;
}

interface BookReaderNavProps {
  items: ReaderNavItem[];
  open: boolean;
  onSelect: (item: ReaderNavItem) => void;
}

export default function BookReaderNav({ items, open, onSelect }: BookReaderNavProps) {
  return (
    <aside
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '280px',
        background: 'rgba(12,12,12,0.96)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 180ms ease',
        zIndex: 25,
        padding: '72px 14px 20px',
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
        Navigation
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              color: '#e5e5e5',
              textAlign: 'left',
              cursor: 'pointer',
              padding: '8px 10px',
              fontSize: '12px',
            }}
          >
            {item.label}
          </button>
        ))}
        {items.length === 0 ? (
          <div style={{ color: '#777', fontSize: '12px' }}>No navigation data available.</div>
        ) : null}
      </div>
    </aside>
  );
}
