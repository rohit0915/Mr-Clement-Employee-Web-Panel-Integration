import { useEffect, useState, type FormEvent } from 'react';
import { FiMail, FiPhone, FiRefreshCw, FiSearch, FiUsers, FiX } from 'react-icons/fi';
import {
  type EmployeeSearchRecord,
  type EmployeeSearchResponse,
  useSearchEmployeesQuery,
} from '@/redux/api/apiSlice';

const getEmployees = (
  response?: EmployeeSearchResponse | EmployeeSearchRecord[],
): EmployeeSearchRecord[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;

  const records = response.data;
  if (!records) return [];
  return records.employees ?? records.results ?? records.users ?? records.items ?? [];
};

const getEmployeeName = (employee: EmployeeSearchRecord) =>
  employee.Name ?? employee.name ?? employee.full_name ?? 'Unnamed employee';

const getEmployeeRole = (employee: EmployeeSearchRecord) =>
  employee.role ??
  employee.Responsibility_id?.Responsibility_name ??
  employee.Role_id?.role_name ??
  'Team member';

const getEmployeeStatus = (employee: EmployeeSearchRecord) => {
  const status = employee.Status ?? employee.status;
  if (typeof status === 'boolean') return status ? 'Active' : 'Inactive';
  return status || 'Status unavailable';
};

const Employees = () => {
  const [searchValue, setSearchValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [limit, setLimit] = useState(5);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchValue.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchValue]);

  const {
    currentData: response,
    isFetching,
    isError,
    refetch,
  } = useSearchEmployeesQuery(
    { q: debouncedQuery, limit },
    { skip: !debouncedQuery },
  );
  const employees = getEmployees(response);
  const responseData =
    response && !Array.isArray(response) && !Array.isArray(response.data)
      ? response.data
      : undefined;
  const resultCount =
    response && !Array.isArray(response)
      ? response.total ?? (responseData && !Array.isArray(responseData) ? responseData.total : undefined)
      : undefined;
  const requestError = response && !Array.isArray(response) && response.success === false;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDebouncedQuery(searchValue.trim());
  };

  const handleClear = () => {
    setSearchValue('');
    setDebouncedQuery('');
  };

  const showError = isError || requestError;

  return (
    <div className="min-h-screen bg-[#f7f8fc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-fuchsia-700">
              People
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Employee directory</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Search your team by name, employee ID, email, or phone number.
            </p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <FiUsers className="text-fuchsia-700" aria-hidden="true" />
            <span>Team search</span>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search employees</span>
              <FiSearch
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Try a name, employee ID, email, or phone"
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-400 focus:bg-white focus:ring-4 focus:ring-fuchsia-100"
                aria-label="Search employees"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  <FiX aria-hidden="true" />
                </button>
              )}
            </label>

            <div className="flex gap-3">
              <label className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600">
                <span className="whitespace-nowrap">Show</span>
                <select
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                  className="bg-transparent font-semibold text-slate-900 outline-none"
                  aria-label="Maximum search results"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </label>
              <button
                type="submit"
                className="h-12 rounded-xl bg-gradient-to-r from-[#6a1b9a] to-[#c02670] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-fuchsia-200"
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
            <p className="text-slate-500" aria-live="polite">
              {debouncedQuery
                ? isFetching
                  ? `Searching for “${debouncedQuery}”…`
                  : showError
                    ? 'Search could not be completed.'
                    : `Results for “${debouncedQuery}”`
                : 'Enter a search term to find an employee.'}
            </p>
            {debouncedQuery && !isFetching && !showError && (
              <p className="font-medium text-slate-600">
                {resultCount !== undefined
                  ? `${resultCount} ${resultCount === 1 ? 'employee' : 'employees'} found`
                  : `${employees.length} ${employees.length === 1 ? 'employee' : 'employees'} found`}
              </p>
            )}
          </div>
        </section>

        {!debouncedQuery ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-50 text-2xl text-fuchsia-700">
              <FiSearch aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Find someone on your team</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Start typing above. Results update as you search.
            </p>
          </div>
        ) : isFetching ? (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600" role="status">
              <FiRefreshCw className="animate-spin text-lg text-fuchsia-700" aria-hidden="true" />
              Searching employees…
            </div>
          </div>
        ) : showError ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-rose-100 bg-white px-6 text-center">
            <p className="font-semibold text-slate-900">
              {requestError ? response?.message || 'The search request was unsuccessful.' : 'Unable to load employees.'}
            </p>
            <p className="mt-1 text-sm text-slate-500">Please check your connection and try again.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FiRefreshCw aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400">
              <FiUsers aria-hidden="true" />
            </div>
            <h2 className="font-semibold text-slate-900">No employees found</h2>
            <p className="mt-1 text-sm text-slate-500">Try another name, ID, email, or phone number.</p>
          </div>
        ) : (
          <section aria-label="Employee search results" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {employees.map((employee, index) => {
                const name = getEmployeeName(employee);
                const employeeId =
                  employee.Employee_id ?? employee.employeeId ?? employee.employee_id_code;
                const image = employee.user_image ?? employee.profile_image ?? employee.image;
                const status = getEmployeeStatus(employee);
                const isActive = status.toLowerCase() === 'active' || status.toLowerCase() === 'true';
                const key =
                  employee._id ??
                  employee.id ??
                  (employeeId !== undefined ? String(employeeId) : undefined) ??
                  employee.email ??
                  `employee-${index}`;

                return (
                  <article
                    key={key}
                    className="flex flex-col gap-4 px-4 py-5 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-100 to-rose-100 font-semibold text-fuchsia-800">
                        {name.slice(0, 1).toUpperCase()}
                        {image && (
                          <img
                            src={image}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate font-semibold text-slate-900">{name}</h2>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : status === 'Status unavailable'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{getEmployeeRole(employee)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 pl-16 text-sm text-slate-500 sm:pl-0">
                      {employeeId !== undefined && (
                        <span className="font-medium text-slate-700">ID {employeeId}</span>
                      )}
                      {employee.email && (
                        <a
                          href={`mailto:${employee.email}`}
                          className="inline-flex items-center gap-2 transition hover:text-fuchsia-700"
                        >
                          <FiMail aria-hidden="true" />
                          <span className="max-w-56 truncate">{employee.email}</span>
                        </a>
                      )}
                      {employee.phone && (
                        <a
                          href={`tel:${employee.phone}`}
                          className="inline-flex items-center gap-2 transition hover:text-fuchsia-700"
                        >
                          <FiPhone aria-hidden="true" />
                          <span>{employee.phone}</span>
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Employees;
