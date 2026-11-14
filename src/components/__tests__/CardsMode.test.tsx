import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CardsMode } from '@/components/CardsMode';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockSpeakText = jest.fn();
const mockCancelSpeech = jest.fn();
jest.mock('@/audio/speech', () => ({
  speakText: (...args: unknown[]) => mockSpeakText(...args),
  cancelSpeech: () => mockCancelSpeech(),
}));

describe('Phase 2A CardsMode & Grammar Modals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders flashcards, speaks tapped word in pt-PT, and cancels speech on unmount', async () => {
    const view = await render(<CardsMode language="en" />);

    expect(screen.getByPlaceholderText('Search word...')).toBeTruthy();
    expect(screen.getByLabelText('Select category')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('Search word...'), 'comer');
    const card = screen.getByLabelText('comer, to eat. Tap to listen.');
    await fireEvent.press(card);

    expect(mockSpeakText).toHaveBeenCalledWith('comer', { language: 'en' });

    await view.unmount();
    expect(mockCancelSpeech).toHaveBeenCalled();
  });

  it('filters by category modal and shows empty-state reset when search has no match', async () => {
    await render(<CardsMode language="tr" />);

    await fireEvent.changeText(screen.getByPlaceholderText('Kelime ara...'), 'zzzznotaword');
    expect(screen.getByText('Eşleşen kelime bulunamadı')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Tüm kelimeleri göster'));
    expect(screen.queryByText('Eşleşen kelime bulunamadı')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Kategori seç'));
    await fireEvent.press(screen.getByLabelText('Fiiller'));
    expect(screen.getAllByLabelText(/fiil çekimlerini göster/).length).toBeGreaterThan(0);
  });

  it('opens ConjugationModal on verb book button, switches A1/A2, and plays slow speech', async () => {
    await render(<CardsMode language="en" />);

    await fireEvent.changeText(screen.getByPlaceholderText('Search word...'), 'falar');
    await fireEvent.press(screen.getByLabelText('Show conjugations for falar'));

    expect(screen.getByText(/FALAR: Conjugações \(A1 Level\)/)).toBeTruthy();
    expect(screen.getByText('PRESENTE')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Speak falo'));
    expect(mockSpeakText).toHaveBeenCalledWith('falo', { language: 'en', rate: 0.65 });

    await fireEvent.press(screen.getByLabelText('A2'));
    expect(screen.getByText(/FALAR: Conjugações \(A2 Level\)/)).toBeTruthy();
    expect(screen.getByText('PARTICÍPIO PASSADO')).toBeTruthy();
  });

  it('opens PrepositionModal on preposition corner button including para spoken contractions', async () => {
    await render(<CardsMode language="en" />);

    await fireEvent.press(screen.getByLabelText('Select category'));
    await fireEvent.press(screen.getByLabelText('Prepositions'));
    await fireEvent.changeText(screen.getByPlaceholderText('Search word...'), 'para');

    await fireEvent.press(screen.getByLabelText('Show contractions for para'));
    expect(screen.getByText('PARA — Preposition & Contractions')).toBeTruthy();
    expect(screen.getByText('pro')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Speak pro'));
    expect(mockSpeakText).toHaveBeenCalledWith('pro', { language: 'en', rate: 0.65 });
  });

  it('opens AdverbModal on adverb corner button and speaks examples', async () => {
    await render(<CardsMode language="tr" />);

    await fireEvent.press(screen.getByLabelText('Kategori seç'));
    await fireEvent.press(screen.getByLabelText('Zarflar'));
    await fireEvent.changeText(screen.getByPlaceholderText('Kelime ara...'), 'também');

    await fireEvent.press(screen.getByLabelText('também kullanım örneklerini göster'));
    expect(screen.getByText(/TAMBÉM — Kullanım Örnekleri/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('também telaffuzunu dinle'));
    expect(mockSpeakText).toHaveBeenCalledWith('também', { language: 'tr', rate: 0.65 });
  });
});
