"use client";

interface BookReaderProgressBarProps {
  percent: number;
}

export default function BookReaderProgressBar({ percent }: BookReaderProgressBarProps) {
  const width = `${Math.max(0, Math.min(100, percent))}%`;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '3px',
        background: 'rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          width,
          height: '100%',
          background: '#22c55e',
          transition: 'width 180ms ease',
        }}
      />
    </div>
  );
}
