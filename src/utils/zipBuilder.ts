export interface ZipEntryInput {
  path: string;
  content: string | Uint8Array;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeU32(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

export function createZipArchive(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.path);
    const dataBytes =
      typeof entry.content === 'string'
        ? encoder.encode(entry.content)
        : entry.content;
    return {
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
    };
  });

  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const item of prepared) {
    const localLen = 30 + item.nameBytes.length + item.dataBytes.length;
    const local = new Uint8Array(localLen);

    // Local file header signature 0x04034b50
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20); // version needed
    writeU16(local, 6, 0x0800); // UTF-8 flag
    writeU16(local, 8, 0); // store (no compression)
    writeU16(local, 10, 0); // mod time
    writeU16(local, 12, 0x5421); // mod date
    writeU32(local, 14, item.crc);
    writeU32(local, 18, item.dataBytes.length);
    writeU32(local, 22, item.dataBytes.length);
    writeU16(local, 26, item.nameBytes.length);
    writeU16(local, 28, 0); // extra field len
    local.set(item.nameBytes, 30);
    local.set(item.dataBytes, 30 + item.nameBytes.length);
    localHeaders.push(local);

    const centralLen = 46 + item.nameBytes.length;
    const central = new Uint8Array(centralLen);
    // Central directory header signature 0x02014b50
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20); // version made by
    writeU16(central, 6, 20); // version needed
    writeU16(central, 8, 0x0800); // UTF-8
    writeU16(central, 10, 0); // store
    writeU16(central, 12, 0); // mod time
    writeU16(central, 14, 0x5421); // mod date
    writeU32(central, 16, item.crc);
    writeU32(central, 20, item.dataBytes.length);
    writeU32(central, 24, item.dataBytes.length);
    writeU16(central, 28, item.nameBytes.length);
    writeU16(central, 30, 0); // extra
    writeU16(central, 32, 0); // comment
    writeU16(central, 34, 0); // disk start
    writeU16(central, 36, 0); // internal attr
    writeU32(central, 38, 0); // external attr
    writeU32(central, 42, offset); // relative offset of local header
    central.set(item.nameBytes, 46);
    centralHeaders.push(central);

    offset += localLen;
  }

  const centralSize = centralHeaders.reduce((acc, c) => acc + c.length, 0);
  const eocd = new Uint8Array(22);
  writeU32(eocd, 0, 0x06054b50);
  writeU16(eocd, 4, 0);
  writeU16(eocd, 6, 0);
  writeU16(eocd, 8, prepared.length);
  writeU16(eocd, 10, prepared.length);
  writeU32(eocd, 12, centralSize);
  writeU32(eocd, 16, offset);
  writeU16(eocd, 20, 0);

  const totalSize = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const l of localHeaders) {
    out.set(l, pos);
    pos += l.length;
  }
  for (const c of centralHeaders) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(eocd, pos);
  return out;
}
