/**
 * @file mp4-verify.mjs — MP4 container structure inspection (faststart verification).
 */
import { openSync, closeSync, readSync, fstatSync } from 'node:fs';

/**
 * Scan top-level MP4 boxes to determine moov/mdat ordering.
 *
 * @param {string} file - mp4 file path
 * @returns {{ order: string[], moovBeforeMdat: boolean, moovIndex: number, mdatIndex: number }}
 */
export function scanMp4Boxes(file) {
  const fd = openSync(file, 'r');
  try {
    const size = fstatSync(fd).size;
    const order = [];
    let pos = 0;
    while (pos + 8 <= size && order.length < 16) {
      const hdr = Buffer.alloc(16);
      readSync(fd, hdr, 0, 8, pos);
      let boxSize = hdr.readUInt32BE(0);
      const type = hdr.toString('ascii', 4, 8);
      let header = 8;
      if (boxSize === 1) {
        readSync(fd, hdr, 0, 16, pos);
        boxSize = Number(hdr.readBigUInt64BE(8));
        header = 16;
      } else if (boxSize === 0) {
        boxSize = size - pos;
      }
      if (!Number.isFinite(boxSize) || boxSize < header) break;
      order.push({ type, offset: pos, size: boxSize });
      if (order.some(x => x.type === 'moov') && order.some(x => x.type === 'mdat')) break;
      pos += boxSize;
    }
    const moov = order.findIndex(x => x.type === 'moov');
    const mdat = order.findIndex(x => x.type === 'mdat');
    return {
      order: order.map(x => x.type),
      moovBeforeMdat: moov >= 0 && mdat >= 0 && moov < mdat,
      moovIndex: moov,
      mdatIndex: mdat,
    };
  } finally {
    closeSync(fd);
  }
}
