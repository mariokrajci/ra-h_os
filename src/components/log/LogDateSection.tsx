import { LogEntry as LogEntryType } from '@/types/database';
import LogEntryComponent from './LogEntry';

interface LogDateSectionProps {
  date: string;
  entries: LogEntryType[];
  onSave: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onPromote: (id: number) => void;
  onEnterAtEnd: (afterId: number) => void;
  onNodeOpen?: (nodeId: number) => void;
  newEntryId?: number | null;
}

function formatDateHeader(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function LogDateSection({
  date, entries, onSave, onDelete, onPromote, onEnterAtEnd, onNodeOpen, newEntryId,
}: LogDateSectionProps) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', color: '#555', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {formatDateHeader(date)}
        </span>
        <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {entries.map(entry => (
          <LogEntryComponent
            key={entry.id}
            entry={entry}
            onSave={onSave}
            onDelete={onDelete}
            onPromote={onPromote}
            onEnterAtEnd={onEnterAtEnd}
            onNodeOpen={onNodeOpen}
            autoFocus={entry.id === newEntryId}
          />
        ))}
      </div>
    </div>
  );
}
