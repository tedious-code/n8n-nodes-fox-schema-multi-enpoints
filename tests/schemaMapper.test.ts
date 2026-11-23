import { extractByPath, keyValueArrayToObject } from '../src/utils/schemaMapper';

describe('Schema Mapper & Helpers', () => {
  it('extracts values using dot notation', () => {
    const data = {
      response: {
        body: {
          items: [
            { id: 101, name: 'Alpha' },
            { id: 102, name: 'Beta' },
          ],
        },
      },
    };

    expect(extractByPath(data, 'response.body.items[0].id')).toBe(101);
    expect(extractByPath(data, 'response.body.items[1].name')).toBe('Beta');
    expect(extractByPath(data, 'nonexistent.path')).toBeUndefined();
  });

  it('converts key-value arrays to objects', () => {
    const entries = [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'X-Custom-Header', value: 'secret123' },
      { key: '', value: 'ignored' },
    ];

    const obj = keyValueArrayToObject(entries);
    expect(obj).toEqual({
      'Content-Type': 'application/json',
      'X-Custom-Header': 'secret123',
    });
  });
});
