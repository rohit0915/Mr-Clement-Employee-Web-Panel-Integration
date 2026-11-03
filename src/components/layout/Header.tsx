import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { useWalkthroughStore } from '@/store/walkthroughStore';
import { useGetProfileQuery } from '@/redux/api/settingsApi';

import HamburgerIcon from '@/assets/navbar/hamburger_menu.svg';
import SearchIcon from '@/assets/navbar/search_icon.svg';
import DownArrowIcon from '@/assets/header/down_arrow.svg';
import NotificationIcon from '@/assets/header/notification_icon.svg';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface Language {
  code: 'en' | 'fr';
  label: string;
  emoji: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

/* ------------------------------------------------------------------ */
/* Static data                                                        */
/* ------------------------------------------------------------------ */

const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', emoji: '🇺🇸' },
  { code: 'fr', label: 'French', emoji: '🇫🇷' },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'New order received',
    body: 'Table 4 placed an order',
    time: '2 min ago',
    read: false,
  },
  {
    id: '2',
    title: 'Shift reminder',
    body: 'Your shift starts at 6:00 PM',
    time: '1 hr ago',
    read: false,
  },
  {
    id: '3',
    title: 'Training module assigned',
    body: 'Food safety level 2',
    time: 'Yesterday',
    read: true,
  },
];

/* ------------------------------------------------------------------ */
/* Hooks                                                              */
/* ------------------------------------------------------------------ */

function useClickOutside<T extends HTMLElement>(
  onClose: () => void,
  isOpen: boolean,
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  const cbRef = useRef(onClose);

  useEffect(() => {
    cbRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        cbRef.current();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cbRef.current();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return ref;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const { data: profileResponse } = useGetProfileQuery();
  const nextWalkthroughStep = useWalkthroughStore((s) => s.next);
  const isProfileWalkthroughStep = useWalkthroughStore(
    (s) => s.isActive && s.steps[s.currentStep]?.selector === '.profile-btn',
  );

  /* ---------------- Derived user ---------------- */
  const displayName = useMemo(() => {
    const profile = profileResponse?.data;
    return (
      profile?.full_name?.trim() ||
      `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() ||
      t('Employee')
    );
  }, [profileResponse, t]);

  const displayAvatar = profileResponse?.data.profile_image || undefined;
  const avatarInitial = displayName.charAt(0).toUpperCase();

  /* ---------------- Language ---------------- */
  const [langOpen, setLangOpen] = useState(false);
  const closeLang = useCallback(() => setLangOpen(false), []);
  const langRef = useClickOutside<HTMLDivElement>(closeLang, langOpen);

  const currentLanguageCode = i18n.resolvedLanguage || 'en';
  const currentLanguage = LANGUAGES.find(l => l.code === currentLanguageCode) || LANGUAGES[0];

  const handleSelectLanguage = useCallback((lang: Language) => {
    i18n.changeLanguage(lang.code);
    setLangOpen(false);
    toast.success(`${t('Language')}: ${t(lang.label)}`, {
      duration: 2000,
      position: 'top-right',
    });
  }, [i18n, t]);

  /* ---------------- Notifications ---------------- */
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [notifOpen, setNotifOpen] = useState(false);

  const closeNotif = useCallback(() => setNotifOpen(false), []);
  const notifRef = useClickOutside<HTMLDivElement>(closeNotif, notifOpen);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleNotificationClick = useCallback(
    (n: Notification) => {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, read: true } : item,
        ),
      );
      setNotifOpen(false);
      navigate('/notifications');
    },
    [navigate],
  );

  /* ---------------- Profile ---------------- */
  const [profileOpen, setProfileOpen] = useState(false);

  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const profileRef = useClickOutside<HTMLDivElement>(closeProfile, profileOpen);

  const handleProfileToggle = useCallback(() => {
    const walkthrough = useWalkthroughStore.getState();
    if (walkthrough.isActive && walkthrough.steps[walkthrough.currentStep]?.selector === '.profile-btn') {
      nextWalkthroughStep();
      return;
    }
    setProfileOpen((v) => !v);
  }, [nextWalkthroughStep]);

  const handleNavigate = useCallback(
    (path: string) => {
      setProfileOpen(false);
      navigate(path);
    },
    [navigate],
  );

  /* ---------------- Search ---------------- */
  const [query, setQuery] = useState('');

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    },
    [navigate, query],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSearchSubmit(e);
    },
    [handleSearchSubmit],
  );

  const clearSearch = useCallback(() => setQuery(''), []);

  /* ---------------- Render ---------------- */
  return (
    // Changed z-40 to z-50 to ensure header sits above page content
    <header
      className="fixed top-0 right-0 z-50 hidden lg:flex items-center justify-between px-8 py-4 bg-white border-r border-[#00000033] shadow-[0px_9px_26px_0px_#0000000D]"
      style={{ left: 'var(--sidebar-width, 260px)' }}
    >
      {/* Left side: Search bar */}
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="flex items-center gap-4 px-4 py-2 rounded-full bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] w-full max-w-sm"
      >
        <button type="button" aria-label="Toggle sidebar" className="flex-shrink-0">
          <img src={HamburgerIcon} alt="" aria-hidden="true" className="h-5 w-5" />
        </button>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={t('Search')}
          aria-label={t('Search')}
          className="bg-transparent focus:outline-none w-full text-gray-800 placeholder-gray-500 font-medium"
        />

        {query && (
          <button type="button" onClick={clearSearch} aria-label="Clear search" className="text-gray-500 hover:text-gray-700 text-sm">
            ✕
          </button>
        )}

        <button type="submit" aria-label="Submit search" className="flex-shrink-0">
          <img src={SearchIcon} alt="" aria-hidden="true" className="h-5 w-5" />
        </button>
      </form>

      {/* Right side: Actions */}
      <div className="flex items-center gap-4">
        {/* ---------------- Language Dropdown ---------------- */}
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={langOpen}
            className="flex items-center gap-3 px-4 py-2 rounded-full bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] cursor-pointer hover:opacity-90"
          >
            <span className="font-medium">{t(currentLanguage.label)}</span>
            <span className="text-lg leading-none" aria-hidden="true">{currentLanguage.emoji}</span>
            <img
              src={DownArrowIcon}
              alt=""
              aria-hidden="true"
              className={`h-3 w-3 transition-transform ${langOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {langOpen && (
            // Changed z-50 to z-[60]
            <div role="menu" className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-[60]">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={lang.code === currentLanguageCode}
                  onClick={() => handleSelectLanguage(lang)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 ${
                    lang.code === currentLanguageCode ? 'bg-gray-50 font-semibold' : ''
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden="true">{lang.emoji}</span>
                  <span>{t(lang.label)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- Notification ---------------- */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={t('Notifications')}
            className="relative cursor-pointer p-2 hover:opacity-80"
          >
            <img src={NotificationIcon} alt="" aria-hidden="true" className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            // Changed z-50 to z-[60]
            <div role="menu" className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-1000">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-sm">{t('Notifications')}</span>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="text-xs text-purple-600 hover:underline">
                    {t('Mark all read')}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    {t('No notifications')}
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${
                        n.read ? '' : 'bg-purple-50/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{t(n.title)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{t(n.body)}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{t(n.time)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                  className="w-full text-center text-sm text-purple-600 font-medium py-3 hover:bg-gray-50"
                >
                  {t('View all')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Profile ---------------- */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={handleProfileToggle}
            className={`flex items-center gap-3 pl-2 pr-4 py-2 rounded-full bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] cursor-pointer hover:opacity-90 ${isProfileWalkthroughStep ? 'profile-btn' : ''}`}
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="avatar" className="h-8 w-8 rounded-full bg-white p-1 object-cover" />
            ) : (
              <span className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-purple-700" aria-hidden="true">
                {avatarInitial}
              </span>
            )}
            <span className="font-medium">{displayName}</span>
            <img
              src={DownArrowIcon}
              alt=""
              aria-hidden="true"
              className={`h-3 w-3 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {profileOpen && (
            // Changed z-50 to z-[60]
            <div role="menu" className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-[60]">
              <button type="button" onClick={() => handleNavigate('/profile')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50">
                {t('View Profile')}
              </button>
              <button type="button" onClick={() => handleNavigate('/settings')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50">
                {t('Settings')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;