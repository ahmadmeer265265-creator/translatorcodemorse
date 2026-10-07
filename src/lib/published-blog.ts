import fs from 'node:fs';
import path from 'node:path';

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const found: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

function isDraft(file: string): boolean {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith('---')) return false;
  const end = text.indexOf('\n---', 3);
  const front = end === -1 ? '' : text.slice(3, end);
  return /^draft:\s*true\s*$/m.test(front);
}

export function hasPublishedBlogPosts(root = process.cwd()): boolean {
  const dir = path.join(root, 'src', 'content', 'blog');
  return walk(dir).some((file) => /\.mdx?$/.test(file) && !isDraft(file));
}
