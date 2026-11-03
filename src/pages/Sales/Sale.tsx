import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'; 
import { 
  useGetDashboardStatsQuery, 
  useGetRestaurantDashboardQuery 
} from '../../api/apiSlice';
import Loader from '@/components/Loader';

const Sale = () => {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<'this_week' | 'all_time'>('this_week');

  // 1. Fetch Data using RTK Query
  const { data: dashboardRes, isLoading: isLoadingDashboard, isError: isErrorDashboard } = useGetDashboardStatsQuery();
  const {
    data: weeklyRes,
    isLoading: isLoadingWeekly,
    isError: isErrorWeekly,
  } = useGetRestaurantDashboardQuery({ filter: 'this_week' });

  // 2. Loading State
  if (isLoadingDashboard || (period === 'this_week' && isLoadingWeekly)) {
    return (
      <div className="flex items-center justify-center w-full min-h-[60vh]">
                               <Loader />
                          </div>
    );
  }

  // 3. Error State
  if (
    isErrorDashboard ||
    (period === 'this_week' && isErrorWeekly) ||
    !dashboardRes?.success ||
    (period === 'this_week' && !weeklyRes?.success)
  ) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-red-500 font-medium bg-red-50 px-4 py-2 rounded-lg border border-red-200">
          {t('Failed to load sales data. Please try again later.')}
        </p>
      </div>
    );
  }

  // 4. Extract & Calculate Data
  const stats = dashboardRes.data;
  const weeklyData = weeklyRes?.data;
  const isThisWeek = period === 'this_week';
  const totalSales = isThisWeek && weeklyData ? weeklyData.TotalSales : stats.TotalSales;
  const totalOrders = isThisWeek && weeklyData ? weeklyData.TotalOrders : stats.TotalOrders;
  const totalSalesStr = totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const allTimeSalesStr = stats.TotalSales.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const periodLabel = isThisWeek ? t('This Week') : t('All Time');
  const dateRange = weeklyData?.dateRange;
  const formatRangeDate = (value: string) => {
    const datePart = value.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    const date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(i18n.resolvedLanguage || 'en', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };
  const displayedRange =
    isThisWeek && dateRange?.start && dateRange?.end
      ? `${formatRangeDate(dateRange.start)} – ${formatRangeDate(dateRange.end)}`
      : isThisWeek
        ? t('Date range unavailable.')
        : t('All Time');

  // The selected period's dashboard response contains period-specific top sellers.
  const topSellers = isThisWeek
    ? weeklyData?.TopSellers || []
    : stats.TopSellers || [];
  
  // Calculate total items sold by summing up the quantities from top sellers
  const totalItemsSold = topSellers.reduce((acc: number, item: any) => acc + (item.total_quantity_sold || 0), 0);

  // Calculate Average Order Value (Total Sales / Total Orders)
  const avgOrderValue = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : '0.00';

 
  const feedback = { lovedIt: 0, good: 0, average: 0, bad: 0, worst: 0 };
  const totalFeedback = 0;
  const avgRating = '0.0'; 

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* --- Header --- */}
        <h1 className="text-2xl font-bold tracking-tight">{t('Sales Performance')}</h1>

        {/* --- Top Hero Card --- */}
        <div className="bg-[#fdf2f8] rounded-2xl p-6 shadow-sm border border-pink-100">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-extrabold text-[#6b21a8] mb-1">{totalSalesStr} XOF</h2>
              <p className="text-gray-500 font-medium">
                {periodLabel}
                {isThisWeek && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {displayedRange}
                  </>
                )}
              </p>
            </div>
            <label className="flex items-center gap-2">
              <span className="sr-only">{t('Report period')}</span>
              <select
                aria-label={t('Report period')}
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value === 'all_time' ? 'all_time' : 'this_week')
                }
                className="bg-white px-4 py-2 rounded-full text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="this_week">{t('This Week')}</option>
                <option value="all_time">{t('All Time')}</option>
              </select>
            </label>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-12 gap-y-4 text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              <span className="text-green-600">{t('Total Sales')}:</span>
              <span className="text-gray-800">₣ {totalSalesStr}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span>•</span>
              <span>{t('Total Orders')}:</span>
              <span className="text-gray-800">{totalOrders}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span>•</span>
              <span>{t('Customer Satisfaction')}:</span>
              <span className="text-gray-800 flex items-center gap-1">
                <span className="text-yellow-500 text-lg leading-none">★</span> {avgRating}
              </span>
            </div>
          </div>
        </div>

        {/* --- Middle Section: Productivity & Reviews --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Productivity Cards Container */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-lg">{t('Productivity')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: Orders Taken */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                <h4 className="font-semibold text-sm mb-4">{t('Orders Taken')}</h4>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-4xl font-bold tracking-tight">{totalOrders}</span>
                </div>
                <p className="text-xs text-green-500 font-medium">{t('Total Orders')}</p>
                <div className="absolute bottom-0 left-0 right-0 h-1 flex">
                  <div className="flex-1 bg-green-400"></div>
                  <div className="flex-1 bg-red-300"></div>
                </div>
              </div>

              {/* Card 2: Items sold */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                <h4 className="font-semibold text-sm mb-4">{t('Items sold')}</h4>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-4xl font-bold tracking-tight">{totalItemsSold}</span>
                </div>
                <p className="text-xs text-orange-500 font-medium">{t('Dish Sold (Top Items)')}</p>
                <div className="absolute bottom-0 left-0 right-0 h-1 flex">
                  <div className="flex-1 bg-orange-300"></div>
                  <div className="flex-1 bg-red-300"></div>
                </div>
              </div>

              {/* Card 3: Average Order Value */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                <h4 className="font-semibold text-sm mb-4">{t('Average Order Value')}</h4>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-3xl font-bold tracking-tight">{avgOrderValue} XOF</span>
                </div>
                <p className="text-xs text-purple-500 font-medium underline decoration-purple-200">{t('Avg Check Amounts')}</p>
                <div className="absolute bottom-0 left-0 right-0 h-1 flex">
                  <div className="flex-1 bg-purple-300"></div>
                  <div className="flex-1 bg-red-300"></div>
                </div>
              </div>

            </div>
          </div>

          {/* Customer Reviews */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-lg mb-6">{t('Customer Reviews')}</h3>
            <div className="space-y-3">
              {[
                { stars: 5, count: feedback.lovedIt, width: totalFeedback > 0 ? `${(feedback.lovedIt / totalFeedback) * 100}%` : '0%', color: 'bg-red-500' },
                { stars: 4, count: feedback.good, width: totalFeedback > 0 ? `${(feedback.good / totalFeedback) * 100}%` : '0%', color: 'bg-red-500' },
                { stars: 3, count: feedback.average, width: totalFeedback > 0 ? `${(feedback.average / totalFeedback) * 100}%` : '0%', color: 'bg-red-500' },
                { stars: 2, count: feedback.bad, width: totalFeedback > 0 ? `${(feedback.bad / totalFeedback) * 100}%` : '0%', color: 'bg-red-500' },
                { stars: 1, count: feedback.worst, width: totalFeedback > 0 ? `${(feedback.worst / totalFeedback) * 100}%` : '0%', color: 'bg-red-500' },
              ].map((row) => (
                <div key={row.stars} className="flex items-center text-sm gap-3">
                  <span className="w-6 font-medium text-gray-600">{row.stars} <span className="text-yellow-500">★</span></span>
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full`} style={{ width: row.width }}></div>
                  </div>
                  <span className="w-8 text-right text-gray-500 text-xs">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- Third Section: KPIs --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h4 className="font-semibold mb-2">{t('Total Sales')}</h4>
            <p className="text-3xl font-bold mb-1">{allTimeSalesStr} XOF</p>
            <p className="text-xs text-green-500">{t('All Time Total')}</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h4 className="font-semibold mb-2">{t('New Customers')}</h4>
            <p className="text-3xl font-bold mb-1">{stats.NewCustomers}</p>
            <p className="text-xs text-purple-500">{t('All Time Total')}</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h4 className="font-semibold mb-2">{t('Repeat Customers')}</h4>
            <p className="text-3xl font-bold mb-1">{stats.RepeatCustomers}</p>
            <p className="text-xs text-orange-500">{t('All Time Total')}</p>
          </div>
        </div>

        {/* --- Bottom Section: Lists --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Top Items */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">{t('Top Items Sold')}</h3>
            <div className="space-y-3">
              {topSellers.slice(0, 4).map((item: any, index: number) => {
                const totalPrice = item.total_quantity_sold * item.item_price;
                return (
                  <div key={item.Items_id || index} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex justify-between items-center">
                    <span className="font-semibold truncate pr-4">{item.item_name}</span>
                    <span className="text-sm font-medium text-red-500 whitespace-nowrap">
                      x{item.total_quantity_sold} - ₣{totalPrice.toLocaleString()}
                    </span>
                  </div>
                );
              })}
              {topSellers.length === 0 && (
                <div className="text-sm text-gray-500 italic p-4 text-center">{t('No items sold yet.')}</div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">{t('Quick Insights')}</h3>
            <div className="space-y-3">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex justify-between items-center h-[68px]">
                <span className="font-semibold">{t('Top Selling Item')}</span>
                <span className="text-xs font-bold text-white bg-green-400 px-3 py-1 rounded-full truncate max-w-[150px]">
                  {topSellers[0]?.item_name || t('N/A')}
                </span>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex justify-between items-center h-[68px]">
                <span className="font-semibold">{t('Avg Feedback Rating')}</span>
                <span className="text-sm font-bold text-gray-700 flex items-center gap-1">
                  {avgRating}/5 <span className="text-red-500 text-lg leading-none">★</span>
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Sale;