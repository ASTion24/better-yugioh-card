const toBytes = async value => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer());
  }
  return new TextEncoder().encode(String(value ?? ''));
};

export const createDeliveryPackage = async files => {
  const { zipSync } = await import('fflate');
  const entries = await Promise.all(
    Object.entries(files).map(async ([name, value]) => [
      name,
      await toBytes(value),
    ]),
  );
  return new Blob([
    zipSync(Object.fromEntries(entries), { level: 0 }),
  ], {
    type: 'application/zip',
  });
};
