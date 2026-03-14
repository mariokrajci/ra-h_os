import { describe, expect, it, vi } from 'vitest';
import {
  sanitizeWebsiteText,
  sanitizeGitHubReadmeRst,
  deriveGitHubReadmeTitle,
  convertMermaidToText,
} from '@/services/typescript/extractors/website';

describe('sanitizeWebsiteText', () => {
  it('removes common repository chrome noise while keeping content', () => {
    const input = [
      'Notifications You must be signed in to change notification settings Fork 7 Star 210',
      'View all files Repository files navigation',
      'Ultra-minimal personal AI agent: starts small, self-modifies its code live.',
      'Quick Start Easy Onboarding',
      'There was an error while loading. Please reload this page.',
      'The system starts from a tiny kernel and grows features incrementally.',
    ].join('\n');

    const cleaned = sanitizeWebsiteText(input);

    expect(cleaned).toContain('Ultra-minimal personal AI agent');
    expect(cleaned).toContain('The system starts from a tiny kernel');
    expect(cleaned).not.toMatch(/signed in|notifications|view all files|error while loading/i);
  });
});

describe('sanitizeGitHubReadmeRst', () => {
  it('removes badge boilerplate and converts common rst structures to markdown-like text', () => {
    const input = [
      '|logo|',
      '',
      '.. |logo| image:: https://raw.githubusercontent.com/example/project/logo.svg',
      '   :target: https://example.com',
      '   :alt: Example',
      '',
      '|version| |coverage|',
      '',
      '.. |version| image:: https://img.shields.io/pypi/v/project.svg',
      '   :target: https://pypi.org/project/project',
      '   :alt: Version',
      '',
      '.. |coverage| image:: https://img.shields.io/codecov/c/github/example/project.svg',
      '   :target: https://codecov.io/github/example/project',
      '   :alt: Coverage',
      '',
      'Project Title',
      '=============',
      '',
      'Project_ is a web scraping framework maintained by Example_.',
      '',
      '.. _Project: https://example.com/project',
      '.. _Example: https://example.com',
      '',
      'Install with:',
      '',
      '.. code:: bash',
      '',
      '    pip install project',
      '',
      'Features',
      '--------',
      '',
      '- Fast crawling',
      '- Clean APIs',
    ].join('\n');

    const cleaned = sanitizeGitHubReadmeRst(input);

    expect(cleaned).toContain('# Project Title');
    expect(cleaned).toContain('[Project](https://example.com/project) is a web scraping framework');
    expect(cleaned).toContain('[Example](https://example.com)');
    expect(cleaned).toContain('```bash');
    expect(cleaned).toContain('pip install project');
    expect(cleaned).toContain('- Fast crawling');
    expect(cleaned).not.toContain('|logo|');
    expect(cleaned).not.toContain('|version|');
    expect(cleaned).not.toContain('.. |coverage| image::');
    expect(cleaned).not.toContain(':target:');
  });

  it('strips community CTA blocks, language toggles, and social link clusters', () => {
    const input = [
      'OpenViking',
      '==========',
      '',
      'OpenViking is an open source AI agent context manager.',
      '',
      'English / 中文',
      '',
      'Join the Community',
      '------------------',
      '',
      'OpenViking is still in its early stages, and there are many areas for improvement and exploration.',
      'We sincerely invite every developer passionate about AI Agent technology:',
      '',
      '- Lark Group: Scan the QR code to join -> View QR Code',
      '- WeChat Group: Scan the QR code to add assistant -> View QR Code',
      '- Discord: Join Discord Server',
      '- X (Twitter): Follow us',
      '',
      "Let's work together to define and build the future of AI Agent context management.",
      '',
      'Quick Start',
      '-----------',
      '',
      '.. code:: bash',
      '',
      '    npm install',
    ].join('\n');

    const cleaned = sanitizeGitHubReadmeRst(input);

    expect(cleaned).toContain('# OpenViking');
    expect(cleaned).toContain('OpenViking is an open source AI agent context manager.');
    expect(cleaned).toContain('## Quick Start');
    expect(cleaned).toContain('npm install');
    expect(cleaned).not.toContain('English / 中文');
    expect(cleaned).not.toContain('Join the Community');
    expect(cleaned).not.toContain('Lark Group');
    expect(cleaned).not.toContain('WeChat Group');
    expect(cleaned).not.toContain('Join Discord Server');
    expect(cleaned).not.toContain('Follow us');
    expect(cleaned).not.toContain('View QR Code');
  });
});

describe('convertMermaidToText', () => {
  it('converts graph TB with subgraphs and inline labels to arrow lines', () => {
    const input = `graph TB
    subgraph TOP[" "]
        AG[AI Coding Agents]
    end
    subgraph MID[" "]
        SL[InsForge Semantic Layer]
    end
    AG --> SL
    SL --> AUTH[Authentication]
    SL --> DB[Database]
    SL --> ST[Storage]`;

    const result = convertMermaidToText(input);
    expect(result).toBe([
      'AI Coding Agents → InsForge Semantic Layer',
      'InsForge Semantic Layer → Authentication',
      'InsForge Semantic Layer → Database',
      'InsForge Semantic Layer → Storage',
    ].join('\n'));
  });

  it('returns original code when no edges are found', () => {
    const input = 'graph TD\n    A[Only node]';
    expect(convertMermaidToText(input)).toBe(input);
  });

  it('handles simple flowchart without subgraphs', () => {
    const input = `flowchart LR
    A[Start] --> B[Process] --> C[End]`;
    const result = convertMermaidToText(input);
    expect(result).toContain('Start → Process');
    expect(result).toContain('Process → End');
  });
});

describe('deriveGitHubReadmeTitle', () => {
  it('prefers the README heading over owner/repo for GitHub README extraction', () => {
    const title = deriveGitHubReadmeTitle(
      'volcengine/OpenViking',
      '# OpenViking: The Context Database for AI Agents\n\nBody text',
    );

    expect(title).toBe('OpenViking: The Context Database for AI Agents');
  });
});
