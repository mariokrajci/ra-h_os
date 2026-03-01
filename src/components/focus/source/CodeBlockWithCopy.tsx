"use client";

import React from 'react';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockWithCopyProps {
  code: string;
  children: React.ReactNode;
}

export default function CodeBlockWithCopy({ code, children }: CodeBlockWithCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  };

  return (
    <div style={{ margin: 0, position: 'relative' }}>
      <button
        onClick={handleCopy}
        title={copied ? 'Copied' : 'Copy code'}
        aria-label={copied ? 'Copied' : 'Copy code'}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          border: '1px solid #30363d',
          background: copied ? '#1f6feb22' : '#0d1117cc',
          color: copied ? '#58a6ff' : '#8b949e',
          borderRadius: 6,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 2,
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {children}
    </div>
  );
}
