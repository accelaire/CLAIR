import { describe, it, expect } from 'vitest';
import { decoderWindows1252 } from './encodage';

const octets = (...valeurs: number[]) => new Uint8Array(valeurs);

describe('decoderWindows1252', () => {
  it("rend l'apostrophe typographique de l'octet 0x92, et non le contrôle U+0092", () => {
    // « l’urgence » tel que l'écrit le CSV des séances de l'Assemblée
    expect(decoderWindows1252(octets(0x6c, 0x92, 0x75, 0x72, 0x67, 0x65, 0x6e, 0x63, 0x65))).toBe('l’urgence');
  });

  it('décode toute la plage 0x80-0x9F que windows-1252 définit', () => {
    expect(decoderWindows1252(octets(0x80, 0x85, 0x8c, 0x96, 0x9c))).toBe('€…Œ–œ');
  });

  it('laisse passer les cinq octets que windows-1252 ne définit pas', () => {
    expect(decoderWindows1252(octets(0x81, 0x8d, 0x8f, 0x90, 0x9d))).toBe('\u0081\u008d\u008f\u0090\u009d');
  });

  it('décode les lettres accentuées comme le latin1', () => {
    expect(decoderWindows1252(octets(0x53, 0xe9, 0x6e, 0x61, 0x74))).toBe('Sénat');
  });

  it('accepte un ArrayBuffer, ce que renvoie axios en responseType arraybuffer', () => {
    expect(decoderWindows1252(octets(0x92).buffer)).toBe('’');
  });
});
