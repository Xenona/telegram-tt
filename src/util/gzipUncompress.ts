// @ts-ignore
// eslint-disable-next-line import/extensions
import pako from 'pako/dist/pako_inflate.min.js';

// this part of code was inspired by webk codebase
import { IS_FIREFOX } from './windowEnvironment';

export default function gzipUncompress(bytes: ArrayBuffer, toString?: boolean): string | Uint8Array {
  const result = pako.inflate(bytes, toString ? { to: 'string' } : undefined);
  return result;
}

export function ungzipTGV(bytes: Uint8Array) {
  const buffer = bytes.slice().buffer;
  if (IS_FIREFOX) {
    let svg = gzipUncompress(buffer) as string;
    const textEncoder = new TextEncoder();
    const tagIdx = svg.indexOf('<svg');
    if (tagIdx) {
      svg = svg.slice(tagIdx);
    }
    return textEncoder.encode(svg
      .replace(
        />/,
        ` width="${((svg.match(/viewBox="(.+?)"/) ?? '')[1].split(' '))[2]}" height="${
          ((svg.match(/viewBox="(.+?)"/) ?? '')[1].split(' '))[3]
        }">`,
      )
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\x7F]/g, ''));
  }
  return gzipUncompress(buffer);
}
