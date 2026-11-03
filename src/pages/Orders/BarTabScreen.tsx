/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Added i18n
import toast from 'react-hot-toast';
import {
  useGetAllBarTabsQuery,
  useCreateBarTabMutation,
  useAddBarTabItemMutation,
  useCloseBarTabWithPaymentMutation,
  useGetAllItemsQuery,
  useGetMyPaymentOptionsQuery,
} from '@/redux/api/quickOrderSlice';
import Loader from '@/components/Loader';

export interface BarTab {
  _id: string;
  Bar_Tab_id: number;
  client_name: string;
  table_no: string;
  status: string;
  CreateAt: string;
  total: number;
  subtotal: number;
  currency?: string;
  payment?: { currency?: string };
  items: Array<{
    _id: string;
    drink_name: string;
    quantity: number;
    line_total: number;
    modifiers?: string[];
  }>;
}

interface Props {
  onBack?: () => void;
}

const formatMoney = (amount: number, currency = 'XOF') =>
  `${Number(amount || 0).toLocaleString()} ${currency}`;

const getConfiguredCurrency = (currency: unknown): string =>
  typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency.trim())
    ? currency.trim().toUpperCase()
    : 'XOF';

const getResponseMessage = (response: unknown): string | undefined => {
  if (!response || typeof response !== 'object') return undefined;
  const body = response as Record<string, unknown>;
  const data = body.data;
  const message =
    body.message ??
    (data && typeof data === 'object'
      ? (data as Record<string, unknown>).message
      : undefined);

  return typeof message === 'string' && message.trim() ? message : undefined;
};

const getSubmissionErrorMessage = (error: unknown, fallback: string): string =>
  getResponseMessage(error) ??
  (error instanceof Error && error.message ? error.message : fallback);

interface DrinkCatalogItem {
  id: number;
  name: string;
  price: number;
  servingSize: string;
  availability: string;
  available: boolean;
}

const getDrinkAvailability = (item: any) => {
  const value =
    item.available ??
    item.is_available ??
    item.Available ??
    item.availability ??
    item.status ??
    item.Status;
  if (value === undefined || value === null || value === '') {
    return { label: 'Availability not specified', available: true };
  }
  const normalized = String(value).toLowerCase();
  const available =
    value !== false &&
    value !== 0 &&
    !['false', '0', 'unavailable', 'out of stock', 'inactive', 'disabled'].includes(normalized);

  return { label: available ? 'Available' : 'Unavailable', available };
};

interface DrinkCatalogSelectorProps {
  id: string;
  value: string;
  currency: string;
  drinks: DrinkCatalogItem[];
  isLoading: boolean;
  isError: boolean;
  selectedDrink: DrinkCatalogItem | null;
  onChange: (value: string) => void;
  onSelect: (drink: DrinkCatalogItem) => void;
}

const DrinkCatalogSelector: React.FC<DrinkCatalogSelectorProps> = ({
  id,
  value,
  currency,
  drinks,
  isLoading,
  isError,
  selectedDrink,
  onChange,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = value.trim().toLocaleLowerCase();
  const isSearching = query.length >= 3;
  const matches = isSearching
    ? drinks.filter((drink) => drink.name.toLocaleLowerCase().includes(query))
    : query.length === 0
      ? drinks
      : [];
  const visibleDrinks = matches.slice(0, 30);
  const listId = `${id}-options`;

  const moveActiveIndex = (direction: 1 | -1) => {
    const indexes = visibleDrinks
      .map((drink, index) => (drink.available ? index : -1))
      .filter((index) => index >= 0);
    if (indexes.length === 0) return;

    const currentPosition = indexes.indexOf(activeIndex);
    const nextPosition = currentPosition < 0
      ? direction === 1 ? 0 : indexes.length - 1
      : Math.max(0, Math.min(currentPosition + direction, indexes.length - 1));
    setActiveIndex(indexes[nextPosition]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      moveActiveIndex(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveIndex(-1);
    } else if (event.key === 'Enter' && isOpen && visibleDrinks[activeIndex]) {
      event.preventDefault();
      const drink = visibleDrinks[activeIndex];
      if (drink.available) {
        onSelect(drink);
        setIsOpen(false);
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={
          isOpen && visibleDrinks[activeIndex]
            ? `${listId}-${visibleDrinks[activeIndex].id}`
            : undefined
        }
        value={value}
        onFocus={() => {
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(-1);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={t('e.g., Mojito')}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8E24AA]"
      />
      {selectedDrink && (
        <p className="text-[11px] text-gray-600 mt-1" aria-live="polite">
          {t(selectedDrink.servingSize)} · {formatMoney(selectedDrink.price, currency)} · {t(selectedDrink.availability)}
        </p>
      )}
      {isOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label={t('Available drinks')}
          className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-gray-500" role="status">{t('Loading drinks...')}</p>
          ) : isError ? (
            <p className="px-3 py-2 text-sm text-red-600" role="alert">{t('Could not load drinks.')}</p>
          ) : query.length > 0 && !isSearching ? (
            <p className="px-3 py-2 text-sm text-gray-500">{t('Type at least 3 characters to search.')}</p>
          ) : visibleDrinks.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">
              {isSearching ? t('No matching drinks.') : t('No drinks in the catalog.')}
            </p>
          ) : (
            <>
              {visibleDrinks.map((drink, index) => (
                <button
                  type="button"
                  id={`${listId}-${drink.id}`}
                  key={drink.id}
                  role="option"
                  aria-selected={selectedDrink?.id === drink.id}
                  disabled={!drink.available}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (!drink.available) return;
                    onSelect(drink);
                    setIsOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    !drink.available
                      ? 'cursor-not-allowed text-gray-400'
                      : activeIndex === index
                        ? 'bg-purple-50'
                        : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium">{drink.name}</span>
                    <span className="shrink-0">{formatMoney(drink.price, currency)}</span>
                  </span>
                  <span className="block text-xs text-gray-500">
                    {t(drink.servingSize)} · {t(drink.availability)}
                  </span>
                </button>
              ))}
              {matches.length > visibleDrinks.length && (
                <p className="px-3 py-2 text-xs text-gray-500">
                  {t('Showing first 30 matches. Refine your search.')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const BarTabScreen: React.FC<Props> = ({ onBack }) => {
  const { t } = useTranslation(); // ✅ Added i18n hook

  // ✅ Moved inside component so modifiers translate properly
  const modifiersList = [
    t('On the rocks'),
    t('Extra lime'),
    t('No ice'),
    t('Double shot'),
    t('Neat'),
    t('Extra mint'),
    t('Salt rim'),
    t('Virgin'),
  ];

  // ✅ Moved inside so relative time translates properly
  const formatRelative = (iso?: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('just now');
    if (m < 60) return `${m} ${t('min ago')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${t('hr ago')}`;
    return `${Math.floor(h / 24)} ${t('day ago')}`;
  };

  // ---------- API ----------
  const { data: tabsRes, isLoading: tabsLoading, refetch: refetchTabs } =
    useGetAllBarTabsQuery({ status: 'Open' });
  const {
    data: drinksRes,
    isLoading: drinksLoading,
    isError: drinksError,
  } = useGetAllItemsQuery({ type: 'Drink', category_id: 'all' });
  const { data: paymentsRes } = useGetMyPaymentOptionsQuery();
  const currency = getConfiguredCurrency(paymentsRes?.currency);

  const [createBarTab, { isLoading: creating }] = useCreateBarTabMutation();
  const [addBarTabItem, { isLoading: addingItem }] = useAddBarTabItemMutation();
  const [closeBarTab, { isLoading: closing }] = useCloseBarTabWithPaymentMutation();

  const tabs: BarTab[] = tabsRes?.data || [];
  const drinkItems = useMemo(
    () => (drinksRes?.data || []).map((it: any) => {
      const { label, available } = getDrinkAvailability(it);
      return {
        id: Number(it.Items_id),
        name: String(it['item-name'] || it.Title || ''),
        price: Number(it['item-price'] ?? it.Price ?? 0),
        servingSize: String(
          it.serving_size ??
            it['serving-size'] ??
            it['item-size'] ??
            it.item_size ??
            it.Size ??
            it.size ??
            'Serving size not specified'
        ),
        availability: label,
        available,
      };
    }).filter((drink: DrinkCatalogItem) => Number.isFinite(drink.id) && drink.name.trim()),
    [drinksRes]
  );

  // ---------- UI state ----------
  const [isHappyHourActive, setIsHappyHourActive] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState<{ tabId: number; tabName: string } | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<BarTab | null>(null);

  // Form state
  const [clientName, setClientName] = useState('');
  const [tableNo, setTableNo] = useState('');
  const [drinkName, setDrinkName] = useState('');
  const [selectedDrink, setSelectedDrink] = useState<DrinkCatalogItem | null>(null);
  const [drinkQty, setDrinkQty] = useState(1);
  const [drinksModifiers, setDrinksModifiers] = useState('');
  const [createTabError, setCreateTabError] = useState('');
  const [addItemError, setAddItemError] = useState('');
  const [createTabFieldErrors, setCreateTabFieldErrors] = useState<{
    clientName?: string;
    tableNo?: string;
    drink?: string;
  }>({});
  const createSubmissionLock = useRef(false);
  const addItemSubmissionLock = useRef(false);

  // ---------- Derived ----------
  const filteredTabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabs;
    return tabs.filter(
      (t_item) =>
        t_item.client_name?.toLowerCase().includes(q) ||
        t_item.table_no?.toLowerCase().includes(q)
    );
  }, [tabs, search]);

  const happyHourTotal = (tab: BarTab) =>
    isHappyHourActive ? Math.round(tab.total * 0.9) : tab.total;

  // ---------- Handlers ----------
  const handleCreateTab = async () => {
    if (creating || createSubmissionLock.current) return;
    const fieldErrors: typeof createTabFieldErrors = {};
    if (!clientName.trim()) {
      fieldErrors.clientName = t('Enter a client name.');
    }
    if (!tableNo.trim()) {
      fieldErrors.tableNo = t('Enter a table number.');
    }
    if (drinkName.trim() && !selectedDrink) {
      fieldErrors.drink = t('Choose a drink from the catalog.');
    }
    setCreateTabFieldErrors(fieldErrors);
    setCreateTabError('');
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }
    const items = selectedDrink
      ? [{
          drink_item_id: selectedDrink.id,
          quantity: Math.max(1, drinkQty),
          modifiers: drinksModifiers ? [drinksModifiers] : [],
        }]
      : [];

    createSubmissionLock.current = true;
    try {
      const response = await createBarTab({
        client_name: clientName.trim(),
        table_no: tableNo.trim(),
        items,
      }).unwrap();
      if ((response as any)?.success === false) {
        throw new Error(getResponseMessage(response) || t('Failed to create bar tab. Please retry.'));
      }
      const createdTabId = (response as any)?.data?.Bar_Tab_id;
      toast.success(
        getResponseMessage(response) ||
          (createdTabId
            ? t('Bar tab #{{id}} created successfully.', { id: createdTabId })
            : t('Bar tab created successfully.')),
      );
      setCreateTabError('');
      setShowAddTabModal(false);
      setClientName(''); setTableNo(''); setDrinkName(''); setSelectedDrink(null); setDrinkQty(1); setDrinksModifiers('');
      refetchTabs();
    } catch (error: unknown) {
      console.error('Failed to create bar tab:', error);
      const message = getSubmissionErrorMessage(error, t('Failed to create bar tab. Please retry.'));
      setCreateTabError(message);
      toast.error(message);
    } finally {
      createSubmissionLock.current = false;
    }
  };

  const handleAddItem = async () => {
    if (!showAddItemModal || addingItem || addItemSubmissionLock.current) return;
    if (!selectedDrink) {
      setAddItemError(t('Choose a drink from the catalog before adding it.'));
      return;
    }
    setAddItemError('');
    addItemSubmissionLock.current = true;
    try {
      const response = await addBarTabItem({
        tabId: showAddItemModal.tabId,
        drink_item_id: selectedDrink.id,
        quantity: Math.max(1, drinkQty),
        modifiers: drinksModifiers ? [drinksModifiers] : [],
      }).unwrap();
      if ((response as any)?.success === false) {
        throw new Error(getResponseMessage(response) || t('Failed to add item. Please retry.'));
      }
      toast.success(getResponseMessage(response) || t('Drink added successfully.'));
      setShowAddItemModal(null);
      setDrinkName(''); setSelectedDrink(null); setDrinkQty(1); setDrinksModifiers('');
      refetchTabs();
    } catch (error: unknown) {
      console.error('Failed to add bar tab item:', error);
      const message = getSubmissionErrorMessage(error, t('Failed to add item. Please retry.'));
      setAddItemError(message);
      toast.error(message);
    } finally {
      addItemSubmissionLock.current = false;
    }
  };

  const handleCloseTab = async (tab: BarTab, method: 'Cash' | 'Credit Card') => {
    const optionId = method === 'Cash' ? 1 : 3;
    try {
      await closeBarTab({
        tabId: tab.Bar_Tab_id,
        Payment_Options_id: optionId,
        payment_method: method,
        payment_confirmed: true,
        ...(method === 'Credit Card' ? { payment_reference: `CARD-${Date.now()}` } : {}),
      }).unwrap();
      setPaymentTarget(null);
      refetchTabs();
    } catch (e: any) {
      console.error(e);
      alert(e?.data?.message || t('Failed to close tab.'));
    }
  };

  const paymentOptions: any[] = Array.isArray(paymentsRes?.data) 
    ? paymentsRes.data 
    : Array.isArray(paymentsRes) 
      ? paymentsRes 
      : [];

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-[#F8F8F8] p-8 font-sans text-gray-800 relative">
      <style>{`
        .hover-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .hover-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .hover-scrollbar::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 10px; transition: background-color .2s ease; }
        .hover-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #cbd5e1; }
        .hover-scrollbar { scrollbar-width: thin; scrollbar-color: transparent transparent; }
        .hover-scrollbar:hover { scrollbar-color: #cbd5e1 transparent; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-2 text-2xl font-bold">
          <button
            onClick={onBack}
            className="hover:text-[#8E24AA] transition-colors text-gray-900"
          >
            {t('Bar Management')}
          </button>
          <span className="text-gray-400 font-light text-xl">{'>'}</span>
          <span className="text-gray-900">{t('Bar tab')}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Happy Hour toggle */}
          <div
            className={`flex items-center justify-between px-4 py-2 rounded-full shadow-sm cursor-pointer transition-colors duration-300 w-[175px] ${
              isHappyHourActive ? 'bg-[#00C853]' : 'bg-[#FF3B30]'
            }`}
            onClick={() => setIsHappyHourActive((v) => !v)}
          >
            <div className="relative w-10 h-5 bg-white rounded-full flex-shrink-0 shadow-inner">
              <div
                className={`absolute w-4 h-4 rounded-full bg-[#8E24AA] shadow-md transform transition-transform duration-300 top-0.5 ${
                  isHappyHourActive ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-[11px] font-bold text-white leading-none whitespace-nowrap">
              {isHappyHourActive ? t('Happy Hour Active') : t('Happy Hour Inactive')}
            </span>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search client / table')}
            className="px-3 py-2 rounded-lg border border-gray-200 text-xs w-44 focus:outline-none focus:border-[#8E24AA]"
          />

          <button
            onClick={() => {
              setDrinkName('');
              setSelectedDrink(null);
              setDrinkQty(1);
              setDrinksModifiers('');
              setCreateTabError('');
              setAddItemError('');
              setCreateTabFieldErrors({});
              setShowAddTabModal(true);
            }}
            className="bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:opacity-90 transition-all flex items-center gap-1 whitespace-nowrap"
          >
            + {t('Open New Tab')}
          </button>
        </div>
      </div>

      {/* Tabs grid */}
      {tabsLoading ? (
       <div className="flex items-center justify-center w-full min-h-[60vh]">
                               <Loader/>
                          </div>
      ) : filteredTabs.length === 0 ? (
        <div className="text-center text-gray-400 py-16 text-sm">
          {t('No open bar tabs.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8 max-h-[60vh] overflow-y-auto pr-2 hover-scrollbar">
          {filteredTabs.map((tab) => {
            return (
              <div
                key={tab._id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden"
              >
                <div className="p-4 pb-2">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-lg font-bold text-gray-900">
                      {tab.client_name} - {tab.table_no}
                    </h3>
                    <span className="text-[9px] font-bold text-[#E53935] bg-[#FFEBEE] px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {tab.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {t('Tab')} #{tab.Bar_Tab_id} <span className="mx-1">•</span>{' '}
                    {formatRelative(tab.CreateAt)}
                  </p>
                </div>

                <div className="px-4 flex-1 min-h-[100px] mb-2">
                  <ul className="space-y-1.5">
                    {tab.items.map((item : any) => (
                      <li key={item._id} className="text-xs text-gray-700">
                        <span className="font-bold">{item.quantity}x</span> {item.drink_name}
                        {item.modifiers?.length > 0 && (
                          <span className="text-gray-400"> - {item.modifiers.join(', ')}</span>
                        )}
                        <span className="float-right text-gray-600 font-semibold">
                          {formatMoney(item.line_total, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 pt-2 border-t border-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-500 font-medium">{t('Running total')}</span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatMoney(happyHourTotal(tab), currency)}
                      {isHappyHourActive && (
                        <span className="text-[10px] text-[#00C853] ml-1">-10%</span>
                      )}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDrinkName('');
                        setSelectedDrink(null);
                        setDrinkQty(1);
                        setDrinksModifiers('');
                        setAddItemError('');
                        setShowAddItemModal({ tabId: tab.Bar_Tab_id, tabName: tab.client_name });
                      }}
                      className="flex-1 bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white py-1.5 rounded-md text-xs font-bold shadow-sm hover:opacity-90 transition-all"
                    >
                      + {t('Add Item')}
                    </button>
                    <button
                      onClick={() => setPaymentTarget(tab)}
                      className="flex-1 bg-white border border-gray-200 text-gray-700 py-1.5 rounded-md text-xs font-bold hover:bg-gray-50 transition-all"
                    >
                      {t('Close tab')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modifiers quick entry */}
      <div className="border border-gray-300 rounded-xl p-4 bg-white/40">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
          {t('Drinks Modifiers - Quick Entry')}
        </h4>
        <div className="flex flex-wrap gap-2 mb-3 max-h-[120px] overflow-y-auto pr-2 hover-scrollbar">
          {modifiersList.map((mod, index) => {
            const highlighted = index < 3;
            return (
              <button
                key={mod}
                onClick={() => setDrinksModifiers(mod)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  drinksModifiers === mod
                    ? 'bg-gradient-to-r from-[#8E24AA] to-[#E53935] text-white shadow-sm'
                    : highlighted
                    ? 'bg-[#F3E5F5] text-[#8E24AA] border border-[#E1BEE7]'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {mod}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-400 font-medium">
          {t('Happy hour 10% discount auto-applied to drinks until 8:00 PM')}
        </p>
      </div>

      {/* ==== Modal: Add New Tab ==== */}
      {showAddTabModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#8E24AA] to-[#E53935] p-5 text-white relative">
              <h2 className="text-xl font-bold mb-1">{t('Add New Tab')}</h2>
              <p className="text-xs text-white/80">{t('Open a new bar tab and optionally add the first drink.')}</p>
              <button
                onClick={() => {
                  if (creating) return;
                  setShowAddTabModal(false);
                }}
                disabled={creating}
                className="absolute top-4 right-4 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="new-tab-client-name" className="block text-xs font-bold text-gray-600 mb-1">{t('Client Name *')}</label>
                  <input
                    id="new-tab-client-name"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setCreateTabFieldErrors((previous) => ({ ...previous, clientName: undefined }));
                      setCreateTabError('');
                    }}
                    aria-invalid={!!createTabFieldErrors.clientName}
                    aria-describedby={createTabFieldErrors.clientName ? 'new-tab-client-error' : undefined}
                    placeholder={t('e.g., Ahmad Aminoff')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8E24AA]"
                  />
                  {createTabFieldErrors.clientName && (
                    <p id="new-tab-client-error" className="mt-1 text-xs text-red-600" role="alert">
                      {createTabFieldErrors.clientName}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="new-tab-table-no" className="block text-xs font-bold text-gray-600 mb-1">{t('Table No *')}</label>
                  <input
                    id="new-tab-table-no"
                    value={tableNo}
                    onChange={(e) => {
                      setTableNo(e.target.value);
                      setCreateTabFieldErrors((previous) => ({ ...previous, tableNo: undefined }));
                      setCreateTabError('');
                    }}
                    aria-invalid={!!createTabFieldErrors.tableNo}
                    aria-describedby={createTabFieldErrors.tableNo ? 'new-tab-table-error' : undefined}
                    placeholder={t('e.g., #7')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8E24AA]"
                  />
                  {createTabFieldErrors.tableNo && (
                    <p id="new-tab-table-error" className="mt-1 text-xs text-red-600" role="alert">
                      {createTabFieldErrors.tableNo}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <label htmlFor="new-tab-drink" className="block text-xs font-bold text-gray-600 mb-1">{t("Drink's Name")}</label>
                  <DrinkCatalogSelector
                    id="new-tab-drink"
                    value={drinkName}
                    currency={currency}
                    drinks={drinkItems}
                    isLoading={drinksLoading}
                    isError={drinksError}
                    selectedDrink={selectedDrink}
                    onChange={(value) => {
                      setDrinkName(value);
                      setSelectedDrink(null);
                      setCreateTabFieldErrors((previous) => ({ ...previous, drink: undefined }));
                      setCreateTabError('');
                    }}
                    onSelect={(drink) => {
                      setSelectedDrink(drink);
                      setDrinkName(drink.name);
                      setCreateTabFieldErrors((previous) => ({ ...previous, drink: undefined }));
                      setCreateTabError('');
                    }}
                  />
                  {createTabFieldErrors.drink && (
                    <p className="mt-1 text-xs text-red-600" role="alert">
                      {createTabFieldErrors.drink}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{t('Modifier')}</label>
                  <select
                    value={drinksModifiers}
                    onChange={(e) => setDrinksModifiers(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8E24AA] bg-white"
                  >
                    <option value="">{t('Select modifier')}</option>
                    {modifiersList.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {createTabError && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {createTabError}
                </p>
              )}

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-600 mb-1">{t('Quantity')}</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDrinkQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-md bg-gray-100 font-bold"
                  >-</button>
                  <span className="w-10 text-center font-bold">{drinkQty}</span>
                  <button
                    onClick={() => setDrinkQty((q) => q + 1)}
                    className="w-8 h-8 rounded-md bg-gray-100 font-bold"
                  >+</button>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 p-4 flex gap-3">
              <button
                onClick={() => {
                  if (creating) return;
                  setShowAddTabModal(false);
                }}
                disabled={creating}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-bold hover:bg-gray-50"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleCreateTab}
                disabled={creating}
                className="flex-1 bg-[#8E24AA] text-white py-2 rounded-lg text-sm font-bold hover:bg-[#7B1FA2] disabled:opacity-50"
              >
                {creating ? t('Creating…') : t('Add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==== Modal: Add Item to Tab ==== */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] p-5 text-white relative">
              <h2 className="text-xl font-bold mb-1">{t('Add Item')}</h2>
              <p className="text-xs text-white/80">
                {t('Tab')}: {showAddItemModal.tabName} (#{showAddItemModal.tabId})
              </p>
              <button
                onClick={() => {
                  if (addingItem) return;
                  setAddItemError('');
                  setShowAddItemModal(null);
                }}
                disabled={addingItem}
                className="absolute top-4 right-4 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <label htmlFor="add-tab-item-drink" className="block text-xs font-bold text-gray-600 mb-1">{t("Drink's Name *")}</label>
                  <DrinkCatalogSelector
                    id="add-tab-item-drink"
                    value={drinkName}
                    currency={currency}
                    drinks={drinkItems}
                    isLoading={drinksLoading}
                    isError={drinksError}
                    selectedDrink={selectedDrink}
                    onChange={(value) => {
                      setDrinkName(value);
                      setSelectedDrink(null);
                      setAddItemError('');
                    }}
                    onSelect={(drink) => {
                      setSelectedDrink(drink);
                      setDrinkName(drink.name);
                      setAddItemError('');
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{t('Modifier')}</label>
                  <select
                    value={drinksModifiers}
                    onChange={(e) => setDrinksModifiers(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">{t('Select modifier')}</option>
                    {modifiersList.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              {addItemError && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {addItemError}
                </p>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">{t('Quantity')}</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDrinkQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-md bg-gray-100 font-bold">-</button>
                  <span className="w-10 text-center font-bold">{drinkQty}</span>
                  <button onClick={() => setDrinkQty((q) => q + 1)} className="w-8 h-8 rounded-md bg-gray-100 font-bold">+</button>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 p-4 flex gap-3">
              <button
                onClick={() => {
                  if (addingItem) return;
                  setAddItemError('');
                  setShowAddItemModal(null);
                }}
                disabled={addingItem}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-bold hover:bg-gray-50"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleAddItem}
                disabled={addingItem || drinksLoading || drinksError}
                className="flex-1 bg-[#8E24AA] text-white py-2 rounded-lg text-sm font-bold hover:bg-[#7B1FA2] disabled:opacity-50"
              >
                {addingItem ? t('Adding…') : t('Add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==== Modal: Close Tab / Payment ==== */}
      {paymentTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#8E24AA] to-[#E53935] p-5 text-white relative">
              <h2 className="text-xl font-bold mb-1">{t('Close Tab')}</h2>
              <p className="text-xs text-white/80">
                {paymentTarget.client_name} - {paymentTarget.table_no}
              </p>
              <button
                onClick={() => setPaymentTarget(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-gray-500">{t('Subtotal')}</span>
                <span className="font-semibold">
                  {formatMoney(paymentTarget.subtotal, currency)}
                </span>
              </div>
              <div className="flex justify-between mb-4 text-sm">
                <span className="text-gray-500">{t('Total due')}</span>
                <span className="font-bold text-gray-900">
                  {formatMoney(happyHourTotal(paymentTarget), currency)}
                </span>
              </div>

              <p className="text-xs font-bold text-gray-600 mb-2">{t('Payment method')}</p>
              <div className="space-y-2 mb-4">
                {paymentOptions.length > 0 ? (
                  paymentOptions.map((po: any) => (
                    <button
                      key={po.Payment_Options_id ?? po.id ?? po.title}
                      onClick={() => handleCloseTab(paymentTarget, po.title?.toLowerCase().includes('cash') ? 'Cash' : 'Credit Card')}
                      disabled={closing}
                      className="w-full text-left border border-gray-200 rounded-lg px-4 py-2 text-sm hover:border-[#8E24AA] hover:bg-[#F3E5F5] transition-colors disabled:opacity-50"
                    >
                      <span className="font-semibold">{po.title ?? po.Name ?? po.name}</span>
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      onClick={() => handleCloseTab(paymentTarget, 'Cash')}
                      disabled={closing}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm hover:border-[#8E24AA] disabled:opacity-50"
                    >
                      {t('Cash')}
                    </button>
                    <button
                      onClick={() => handleCloseTab(paymentTarget, 'Credit Card')}
                      disabled={closing}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm hover:border-[#8E24AA] disabled:opacity-50"
                    >
                      {t('Credit Card')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarTabScreen;