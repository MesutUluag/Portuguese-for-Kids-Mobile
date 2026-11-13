import React from 'react';
import { useAuth } from '@/auth/AuthContext';
import { AuthModal } from '@/auth/AuthModal';
import { LeaderboardModal } from '@/auth/LeaderboardModal';
import { NicknamePickerModal } from '@/auth/NicknamePickerModal';
import { ParentalGateModal } from '@/auth/ParentalGateModal';
import { StatsModal } from '@/auth/StatsModal';

export interface AuthModalsHostProps {
  language: 'en' | 'tr';
}

export function AuthModalsHost({ language }: AuthModalsHostProps) {
  const {
    parentalGateRequest,
    closeParentalGate,
    isNicknamePickerOpen,
    needsNickname,
    profile,
    confirmNickname,
    closeNicknamePicker,
  } = useAuth();

  return (
    <>
      <AuthModal language={language} />
      <StatsModal language={language} />
      <LeaderboardModal language={language} />
      <NicknamePickerModal
        visible={isNicknamePickerOpen}
        language={language}
        currentName={profile?.displayName}
        onConfirm={confirmNickname}
        onCancel={needsNickname ? undefined : closeNicknamePicker}
      />
      <ParentalGateModal
        visible={Boolean(parentalGateRequest)}
        language={language}
        reason={parentalGateRequest?.reason}
        onSuccess={() => parentalGateRequest?.onSuccess()}
        onCancel={closeParentalGate}
      />
    </>
  );
}
