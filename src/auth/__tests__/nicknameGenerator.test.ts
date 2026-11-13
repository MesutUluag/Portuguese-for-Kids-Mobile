import {
  generateNickname,
  generateNicknameOptions,
  isGeneratedNickname,
  isNicknameValid,
  shouldPromptNickname,
} from '@/auth/nicknameGenerator';

describe('nicknameGenerator', () => {
  it('generates single-token child-safe nicknames in both EN and TR', () => {
    for (let i = 0; i < 20; i++) {
      const en = generateNickname('en');
      const tr = generateNickname('tr');
      expect(isNicknameValid(en)).toBe(true);
      expect(isNicknameValid(tr)).toBe(true);
      expect(isGeneratedNickname(en)).toBe(true);
      expect(isGeneratedNickname(tr)).toBe(true);
      expect(en).not.toMatch(/[\s@0-9]/);
      expect(tr).not.toMatch(/[\s@0-9]/);
    }
  });

  it('returns distinct options including proper Turkish diacritics', () => {
    const optionsEn = generateNicknameOptions('en', 6);
    const optionsTr = generateNicknameOptions('tr', 24);

    expect(optionsEn.length).toBe(6);
    expect(new Set(optionsEn).size).toBe(6);
    expect(optionsTr.length).toBe(24);
    expect(new Set(optionsTr).size).toBe(24);
    expect(optionsTr.some((n) => /[çğıöşüÇĞİÖŞÜ]/.test(n))).toBe(true);
    expect(isNicknameValid('HızlıBaykuş')).toBe(true);
    expect(isNicknameValid('ŞanslıKaplumbağa')).toBe(true);
    expect(isGeneratedNickname('HizliBaykus')).toBe(true);
    expect(isGeneratedNickname('HızlıBaykuş')).toBe(true);
  });

  it('flags missing, placeholder, email, real single-word names, and multi-word provider names', () => {
    expect(shouldPromptNickname(undefined)).toBe(true);
    expect(shouldPromptNickname('')).toBe(true);
    expect(shouldPromptNickname('Kid Explorer')).toBe(true);
    expect(shouldPromptNickname('Explorer')).toBe(true);
    expect(shouldPromptNickname('parent@example.com')).toBe(true);
    expect(shouldPromptNickname('Jane Doe')).toBe(true);
    expect(shouldPromptNickname('Mesut')).toBe(true);
    expect(shouldPromptNickname('BraveOwl')).toBe(false);
    expect(shouldPromptNickname('HızlıBaykuş')).toBe(false);
  });
});
