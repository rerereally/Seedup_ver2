import Link from 'next/link';

type Block =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'source'; text: string };

export default function MarkdownContent({ content }: { content: string }) {
  const blocks = parseBlocks(prettifyPlainText(content));

  return (
    <div className="article-markdown">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Tag = block.level === 2 ? 'h2' : 'h3';
          return <Tag key={index}>{renderInline(block.text)}</Tag>;
        }

        if (block.type === 'quote') {
          return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
        }

        if (block.type === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'code') {
          return (
            <pre key={index}>
              <code>{block.text}</code>
            </pre>
          );
        }

        if (block.type === 'source') {
          return (
            <div key={index} className="article-source">
              {renderInline(block.text)}
            </div>
          );
        }

        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}

function prettifyPlainText(content: string) {
  const normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) return '';
  if (hasMarkdownShape(normalized) || normalized.includes('\n\n')) return normalized;

  return splitLongText(normalized).join('\n\n');
}

function hasMarkdownShape(value: string) {
  return /(^|\n)(#{2,3}\s|[-*]\s|\d+\.\s|>\s|```)/.test(value);
}

function splitLongText(value: string) {
  const sentences = value
    .replace(/\s*(<출처[:：][^>]+>)\s*/g, '\n\n$1\n\n')
    .split(/(?<=[.!?。]|다\.|요\.|니다\.|죠\.|습니다\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return [value];

  const paragraphs: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > 420 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = (current ? `${current} ${sentence}` : sentence).trim();
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs;
}

function parseBlocks(content: string) {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    if (text) blocks.push(isSource(text) ? { type: 'source', text } : { type: 'paragraph', text });
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push({ type: 'list', items: list });
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      if (code) {
        blocks.push({ type: 'code', text: code.join('\n') });
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(rawLine);
      continue;
    }

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: heading[1].length === 2 ? 2 : 3, text: heading[2] });
      continue;
    }

    const listItem = line.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      list.push(listItem[2]);
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'quote', text: line.slice(2) });
      continue;
    }

    if (isSource(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'source', text: line });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  if (code) blocks.push({ type: 'code', text: code.join('\n') });
  return blocks;
}

function isSource(text: string) {
  return /^<?출처[:：]/.test(text) || /^source[:：]/i.test(text);
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return parts.map((part, index) => {
    const strong = part.match(/^\*\*([^*]+)\*\*$/);
    if (strong) return <strong key={index}>{strong[1]}</strong>;

    const code = part.match(/^`([^`]+)`$/);
    if (code) return <code key={index}>{code[1]}</code>;

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <Link key={index} href={link[2]} target={link[2].startsWith('http') ? '_blank' : undefined}>
          {link[1]}
        </Link>
      );
    }

    return part;
  });
}
