import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PrivacyPolicyModal } from '@/auth/PrivacyPolicyModal';

describe('PrivacyPolicyModal', () => {
  it('renders bilingual English and Turkish policy content offline', async () => {
    const onClose = jest.fn();
    const onOpenExternal = jest.fn();

    const view = await render(
      <PrivacyPolicyModal
        visible
        language="en"
        onClose={onClose}
        onOpenExternal={onOpenExternal}
      />,
    );

    expect(screen.getByText('Privacy Policy — Portuguese for Kids')).toBeTruthy();
    expect(screen.getByText(/Kid-Safe • Zero Ads • Zero Tracking/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Open web version'));
    expect(onOpenExternal).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('privacy-policy-done-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await view.rerender(
      <PrivacyPolicyModal
        visible
        language="tr"
        onClose={onClose}
        onOpenExternal={onOpenExternal}
      />,
    );

    expect(screen.getByText('Gizlilik Politikası — Portuguese for Kids')).toBeTruthy();
    expect(screen.getByText(/Çocuk Dostu • Sıfır Reklam • Sıfır Takip/)).toBeTruthy();
    await view.unmount();
  });
});
