// src/pages/Setting/Settings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // ✅ Added i18n
import accountIcon from '@/assets/setting/account_card.svg';
import notificationIcon from '@/assets/setting/Notification.svg';
import changePasswordIcon from '@/assets/setting/Unlock.svg';
import workSummaryIcon from '@/assets/setting/work_summary.svg';
import headphoneIcon from '@/assets/setting/suppport_tickets.svg';
import { useWalkthroughStore } from '@/store/walkthroughStore';

const Settings: React.FC = () => {
  const { t } = useTranslation(); // ✅ Added i18n hook
  
  const [clockedIn, setClockedIn] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isActive,
    steps,
    currentStep,
    setSettingsHighlight,
    goTo,
    next,
    settingsHighlight,
  } = useWalkthroughStore();

  // Helper: handle walkthrough advance on card click
  const handleWalkthroughAdvance = useCallback(
    (selector: string, highlightKey: string, advanceOn: 'ui' | 'both' = 'both') => {
      const step = steps[currentStep];
      if (
        isActive &&
        step &&
        step.selector === selector &&
        (step.advanceOn === advanceOn || step.advanceOn === 'both' || !step.advanceOn)
      ) {
        setSettingsHighlight(highlightKey);
        next();
      }
    },
    [isActive, steps, currentStep, setSettingsHighlight, next]
  );

  // ✅ Moved inside the component so labels update when language changes
  const cardData = [
    {
      icon: accountIcon,
      title: t('Personal info'),
      desc: t('View your personal details and contact information.'),
      selector: '.settings-personal-info',
      highlightKey: 'profile',
      onClick: () => {
        handleWalkthroughAdvance('.settings-personal-info', 'profile');
        navigate('/profile');
      },
    },
    {
      icon: notificationIcon,
      title: t('Notifications'),
      desc: t('Manage your notification preferences.'),
      selector: '.settings-notifications',
      highlightKey: 'notifications',
      onClick: () => {
        handleWalkthroughAdvance('.settings-notifications', 'notifications');
        navigate('/notifications');
      },
    },
    {
      icon: changePasswordIcon,
      title: t('Login & Security'),
      desc: t('Update your recovery email and password.'),
      selector: '.settings-login-security',
      highlightKey: 'security',
      onClick: () => {
        handleWalkthroughAdvance('.settings-login-security', 'security');
        navigate('/profile', { state: { tab: 'security' } });
      },
    },
    {
      icon: workSummaryIcon,
      title: t('Work Summary'),
      desc: t('Review your attendance, hours, and work performance.'),
      selector: '.settings-work-summary',
      highlightKey: 'work',
      onClick: () => {
        handleWalkthroughAdvance('.settings-work-summary', 'work');
        navigate('/profile', { state: { tab: 'work' } });
      },
    },
    {
      icon: headphoneIcon,
      title: t('Support Tickets'),
      desc: t('Create and track your support requests.'),
      selector: '.settings-contact-support',
      highlightKey: 'contact-support',
      onClick: () => {
        handleWalkthroughAdvance('.settings-contact-support', 'contact-support');
        navigate('/settings/contact-support');
      },
    },
  ];

  // Reset walkthrough when returning from profile
  useEffect(() => {
    if (settingsHighlight === 'notifications-reset') {
      const idx = steps.findIndex((s) => s.selector === '.settings-notifications');
      if (idx !== -1) goTo(idx);
      setSettingsHighlight('');
    }
  }, [settingsHighlight, steps, goTo, setSettingsHighlight]);

  const isHighlighted = (selector: string) =>
    isActive && steps[currentStep]?.selector === selector && location.pathname === '/settings';

  return (
    <div className="p-8 min-h-screen bg-white">
      <h1 className="text-2xl font-bold mb-8">{t('Settings')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {cardData.map((card) => (
          <div
            key={card.title}
            className={`bg-white rounded-xl shadow-sm p-6 flex flex-col gap-2 cursor-pointer transition hover:shadow-md ${
              card.selector.replace('.', '')
            } ${isHighlighted(card.selector) ? ' walkthrough-highlight' : ''}`}
            onClick={card.onClick}
          >
            <img src={card.icon} alt={card.title} className="w-8 h-8 mb-2" />
            <div className="font-bold text-lg">{card.title}</div>
            <div className="text-[#00000099] text-sm">{card.desc}</div>
          </div>
        ))}

        {/* Clock in/out – fixed toggle */}
        <div
          className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-2 cursor-pointer transition hover:shadow-md settings-clock-in-out"
          onClick={() => navigate('/settings/clock-in-out')}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-16 h-8 flex items-center rounded-full transition-colors duration-200 shadow p-2"
              style={{ minWidth: 48 }}
              onClick={(e) => {
                e.stopPropagation();
                setClockedIn((v) => !v);
              }}
            >
              <div
                className={`w-6 h-6 rounded-full shadow transform transition-transform duration-200 flex items-center justify-center text-xs font-bold ${
                  clockedIn
                    ? 'translate-x-6 bg-primary-gradient text-white'
                    : 'translate-x-0 bg-primary-gradient-light text-black'
                }`}
              >
                {clockedIn ? 'ON' : 'OFF'}
              </div>
            </div>
          </div>
          <div className="font-bold text-lg">{t('Clock in / out')}</div>
          <div className="text-[#00000099] text-sm">{t('Record the start and end of your shift.')}</div>
        </div>
      </div>
    </div>
  );
};

export default Settings;