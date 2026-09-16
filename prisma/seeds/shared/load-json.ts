import { readFile } from 'node:fs/promises';

export async function loadJson<T>(path: string): Promise<T> {
  const file = await readFile(path, 'utf8');

  return JSON.parse(file) as T;
}
