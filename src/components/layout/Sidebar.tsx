import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // <-- Added i18n
import { FiUserCheck } from 'react-icons/fi';

// Sidebar PNG icons
import quickOrder from '@/assets/sidebar/quickorder.png';
import table from '@/assets/sidebar/table.png';
import shift from '@/assets/sidebar/shift.png';
import training from '@/assets/sidebar/training.png';
import reservation from '@/assets/sidebar/reservation.png';
import logoutIcon from '@/assets/sidebar/logout.png';
import chat from '@/assets/sidebar/chat.png';
import setting from '@/assets/sidebar/settings.png';
import saleperfomance from '@/assets/sidebar/sp.png';
import attendance from '@/assets/sidebar/calendar.png';
import orderhistory from '@/assets/sidebar/orderhistory.png';
import OrderHistoryIcon from '@/assets/navbar/table_icon.svg';
import { useWalkthroughStore } from '@/store/walkthroughStore';
import logoUpdated from '@/assets/LOGOPlande.svg';
// NOTE: Removed the static arrays from here and moved them inside the component

interface SidebarProps {
  onLogoutClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogoutClick }) => {
  const location = useLocation();
  const { t } = useTranslation(); // <-- Initialize translation hook
  const { isActive: isWalkthroughActive, activeTraining, steps, currentStep, next } =
    useWalkthroughStore();
  const isOrderTraining = isWalkthroughActive && activeTraining === 'order';
  const isTableTrainingStep =
    isOrderTraining && steps[currentStep]?.selector === '.table-btn';
  const isOrderHistoryTrainingStep =
    isOrderTraining && steps[currentStep]?.selector === '.order-history-btn';
  const isCurrentTrainingStep = (selector: string) =>
    isWalkthroughActive && steps[currentStep]?.selector === selector;
  const isActive = (path: string) => location.pathname.startsWith(path);

  // Selected (active) button style
  const selectedClasses =
    'text-white shadow-md bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)]';
  // Default (unselected) button style
  const defaultClasses = 'text-gray-700 hover:bg-[#F3E5F5]';

  // Moved inside component so they re-render when language changes
  const navItems = [
    { label: t('Quick order'), icon: quickOrder, path: '/orders', isSvg: false },
    { label: t('Table'), icon: table, path: '/table', isSvg: false },
    { label: t('Order History'), icon: orderhistory, path: '/order-history', isSvg: true },
    { label: t('Reservations'), icon: reservation, path: '/reservations', isSvg: false },
  ];

  const trainingItems = [
    { label: t('Training'), icon: training, path: '/training', isSvg: false },
    { label: t('Team chats'), icon: chat, path: '/team-chats', isSvg: false },
    { label: t('Attendance'), icon: attendance, path: '/attendance', isSvg: false },
    { label: t('Sales Performance'), icon: saleperfomance, path: '/sales-performance', isSvg: false },
    { label: t('Work Shifts'), icon: shift, path: '/work-shifts', isSvg: false },
  ];

  const bottomItems = [
    { label: t('Setting'), icon: setting, path: '/settings', isSvg: false },
    { label: t('sign out'), icon: logoutIcon, path: '/logout', isSvg: false },
  ];

  const renderIcon = (item: any, active: boolean) => {
    if (item.isSvg || typeof item.icon === 'string') {
      return (
        <img
          src={item.icon}
          alt={item.label}
          className={`h-5 w-5 shrink-0 object-contain ${
            active ? 'brightness-0 invert' : 'opacity-70'
          }`}
        />
      );
    }
    const IconComponent = item.icon;
    return (
      <IconComponent
        size={20}
        className={`shrink-0 ${active ? 'text-white' : 'text-gray-700'}`}
      />
    );
  };

  return (
    <aside className="hidden lg:flex flex-col h-screen w-[260px] fixed bg-[#FFF5F9] border-r border-[#0000001A]">
      <div className="px-6  pb-2 shrink-0">
        <Link to="/">
          <img src={logoUpdated} alt="TRIAXX logo" className="" />
        </Link>
      </div>

      <div className="sidebar-scroll flex-1 overflow-y-auto px-4">
        <nav className="flex flex-col gap-1 mb-6">
          {navItems.map((item) => (
            <Link
              key={item.path} // <-- Changed key to path to avoid issues if translations duplicate
              to={item.path}
              onClick={(event) => {
                if (
                  item.path === '/orders' &&
                  isOrderTraining &&
                  steps[currentStep]?.selector === '.quick-order-btn'
                ) {
                  event.preventDefault();
                  next();
                } else if (item.path === '/table' && isTableTrainingStep) {
                  event.preventDefault();
                  next();
                } else if (item.path === '/order-history' && isOrderHistoryTrainingStep) {
                  event.preventDefault();
                  next();
                }
              }}
              className={`flex items-center gap-4 px-4 py-3 rounded-full font-medium transition-all duration-200 ${
                isActive(item.path) ? selectedClasses : defaultClasses
              } ${
                isOrderTraining && item.path === '/orders'
                  ? 'quick-order-btn'
                  : isTableTrainingStep && item.path === '/table'
                    ? 'table-btn'
                    : isOrderHistoryTrainingStep && item.path === '/order-history'
                      ? 'order-history-btn'
                    : ''
              }`}
            >
              {renderIcon(item, isActive(item.path))}
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="mb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
          {t('Training')}
        </div>
        <nav className="flex flex-col gap-1 mb-6">
          {trainingItems.map((item) => (
            <Link
              key={item.path} // <-- Changed key to path
              to={item.path}
              onClick={(event) => {
                if (item.path === '/team-chats' && isCurrentTrainingStep('.team-chats-btn')) {
                  event.preventDefault();
                  next();
                }
              }}
              className={`flex items-center gap-4 px-4 py-3 rounded-full font-medium transition-all duration-200 ${
                isActive(item.path) ? selectedClasses : defaultClasses
              } ${isCurrentTrainingStep('.team-chats-btn') && item.path === '/team-chats' ? 'team-chats-btn' : ''}`}
            >
              {renderIcon(item, isActive(item.path))}
              <span className="text-sm leading-tight">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="shrink-0 px-4 pb-6 pt-2 flex flex-col gap-1">
        {bottomItems.map((item) => {
          if (item.label === t('sign out')) { // <-- Check against translated string
            return (
              <button
                key={item.path}
                onClick={onLogoutClick}
                className={`flex w-full items-center gap-4 px-4 py-3 rounded-full font-medium transition-all duration-200 ${defaultClasses}`}
              >
                <img
                  src={item.icon}
                  alt={item.label}
                  className="h-5 w-5 shrink-0 opacity-70"
                />
                <span className="text-sm">{t('Sign out')}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(event) => {
                if (item.path === '/settings' && isCurrentTrainingStep('.settings-btn')) {
                  event.preventDefault();
                  next();
                }
              }}
              className={`flex items-center gap-4 px-4 py-3 rounded-full font-medium transition-all duration-200 ${
                isActive(item.path) ? selectedClasses : defaultClasses
              } ${item.path === '/settings' && isCurrentTrainingStep('.settings-btn') ? 'settings-btn' : ''}`}
            >
              {renderIcon(item, isActive(item.path))}
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;