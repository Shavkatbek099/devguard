/** Tiny glob → RegExp (supports `**`, `*`, `?`). Paths are always POSIX-style relative paths. */
export function globToRegExp(glob: string): RegExp {
  let g = glob.replace(/\\/g, '/').replace(/^\.\//, '');
  const anchoredDir = g.endsWith('/');
  if (anchoredDir) g = g.slice(0, -1);
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const ch = g[i]!;
    if (ch === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  // A pattern without a slash matches at any depth; always match descendants of matched dirs.
  const prefix = g.includes('/') ? '^' : '^(?:.*/)?';
  return new RegExp(`${prefix}${re}(?:/.*)?$`);
}

export function matchesAny(path: string, res: RegExp[]): boolean {
  return res.some((r) => r.test(path));
}
