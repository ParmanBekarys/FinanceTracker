import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'finance-tracker-mobile-v1'
const CATEGORIES_STORAGE_KEY = 'finance-tracker-categories-v1'
const BALANCE_STORAGE_KEY = 'finance-tracker-opening-balance-v1'
const ACCOUNTS_STORAGE_KEY = 'finance-tracker-accounts-v1'
const DATA_RESET_KEY = 'finance-tracker-data-reset-v1'
const DATA_RESET_VERSION = '2'

if (typeof window !== 'undefined' && localStorage.getItem(DATA_RESET_KEY) !== DATA_RESET_VERSION) {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(BALANCE_STORAGE_KEY)
  localStorage.setItem(DATA_RESET_KEY, DATA_RESET_VERSION)
}

const defaultCategories = [
  'Food',
  'Transport',
  'Bills',
  'Shopping',
  'Health',
  'Salary',
  'Freelance',
  'Gift',
  'Other',
]

const defaultTransactions = []
const defaultAccounts = [{ id: 'main-card', name: 'Main card', balance: 0 }]

const getToday = () => new Date().toISOString().slice(0, 10)

const chartColors = ['#17805c', '#36b878', '#8bd8ad', '#bfead0', '#f2b880', '#ef8d8d', '#8bb7e8']
const isQuickAddUrl = () => window.location.hash === '#add'

function App() {
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : defaultTransactions
    } catch {
      return defaultTransactions
    }
  })

  const [userCategories, setUserCategories] = useState(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY)
      return saved ? JSON.parse(saved) : defaultCategories
    } catch {
      return defaultCategories
    }
  })

  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem(ACCOUNTS_STORAGE_KEY)
      if (saved) return JSON.parse(saved)

      const legacyBalance = Number(localStorage.getItem(BALANCE_STORAGE_KEY)) || 0
      return [{ ...defaultAccounts[0], balance: legacyBalance }]
    } catch {
      return defaultAccounts
    }
  })

  const [type, setType] = useState('expense')
  const [category, setCategory] = useState('Food')
  const [filterCategory, setFilterCategory] = useState('All')
  const [selectedAccountId, setSelectedAccountId] = useState('all')
  const [period, setPeriod] = useState('all')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getToday)
  const [note, setNote] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(isQuickAddUrl)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activePage, setActivePage] = useState('balance')
  const [isQuickAddPage, setIsQuickAddPage] = useState(isQuickAddUrl)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [newAccount, setNewAccount] = useState('')
  const [editingAccountId, setEditingAccountId] = useState(null)
  const [accountDraft, setAccountDraft] = useState('')
  const [accountId, setAccountId] = useState(() => accounts[0]?.id || 'main-card')
  const [selectedMonthKey, setSelectedMonthKey] = useState(null)
  const [selectedDayKey, setSelectedDayKey] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
  }, [transactions])

  useEffect(() => {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(userCategories))
  }, [userCategories])

  useEffect(() => {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts))
  }, [accounts])

  useEffect(() => {
    const fallbackAccountId = accounts[0]?.id
    if (!fallbackAccountId || transactions.every((item) => item.accountId)) return

    setTransactions((current) => current.map((item) => ({
      ...item,
      accountId: item.accountId || fallbackAccountId,
    })))
  }, [accounts, transactions])

  useEffect(() => {
    const handleHashChange = () => {
      const quickAdd = isQuickAddUrl()
      setIsQuickAddPage(quickAdd)

      if (quickAdd) {
        setType('expense')
        setEditMode(false)
        setIsFormOpen(true)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const filteredTransactions = useMemo(() => {
    const now = new Date()

    return transactions.filter((item) => {
      const itemDate = new Date(item.date)
      const isInPeriod = (() => {
        if (period === 'week') {
          const weekAgo = new Date(now)
          weekAgo.setDate(now.getDate() - 7)
          return itemDate >= weekAgo && itemDate <= now
        }

        if (period === 'month') {
          const monthAgo = new Date(now)
          monthAgo.setMonth(now.getMonth() - 1)
          return itemDate >= monthAgo && itemDate <= now
        }

        return true
      })()

      const matchesCategory = filterCategory === 'All' || item.category === filterCategory
      const matchesAccount = selectedAccountId === 'all' || item.accountId === selectedAccountId

      return isInPeriod && matchesCategory && matchesAccount
    })
  }, [transactions, filterCategory, period, selectedAccountId])

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const expense = filteredTransactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const selectedOpeningBalance = selectedAccountId === 'all'
      ? accounts.reduce((sum, item) => sum + Number(item.balance), 0)
      : Number(accounts.find((item) => item.id === selectedAccountId)?.balance || 0)

    return {
      income,
      expense,
      balance: selectedOpeningBalance + income - expense,
    }
  }, [filteredTransactions, accounts, selectedAccountId])

  const spendingBreakdown = useMemo(() => {
    const totals = filteredTransactions
      .filter((item) => item.type === 'expense')
      .reduce((result, item) => {
        result[item.category] = (result[item.category] || 0) + Number(item.amount)
        return result
      }, {})

    return Object.entries(totals)
      .map(([categoryName, total]) => ({
        category: categoryName,
        total,
        percent: summary.expense ? Math.round((total / summary.expense) * 100) : 0,
      }))
      .sort((first, second) => second.total - first.total)
  }, [filteredTransactions, summary.expense])

  const donutGradient = useMemo(() => {
    let currentPercent = 0

    const segments = spendingBreakdown.map((item, index) => {
      const startPercent = currentPercent
      currentPercent += item.percent
      return `${chartColors[index % chartColors.length]} ${startPercent}% ${currentPercent}%`
    })

    return segments.length ? `conic-gradient(${segments.join(', ')})` : '#edf7f1'
  }, [spendingBreakdown])

  const monthlyArchive = useMemo(() => {
    const years = {}

    transactions.forEach((item) => {
      const [year, month, day] = item.date.split('-')
      years[year] ??= {}
      years[year][month] ??= {}
      years[year][month][day] ??= []
      years[year][month][day].push(item)
    })

    return Object.entries(years)
      .sort(([firstYear], [secondYear]) => secondYear.localeCompare(firstYear))
      .map(([year, months]) => ({
        year,
        months: Object.entries(months)
          .sort(([firstMonth], [secondMonth]) => secondMonth.localeCompare(firstMonth))
          .map(([month, days]) => ({
            month,
            monthName: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(`${year}-${month}-01`)),
            days,
          })),
      }))
  }, [transactions])

  const formatMoney = (value) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(value)

  const resetForm = () => {
    setAmount('')
    setDate(getToday())
    setNote('')
    setType('expense')
    setCategory('Food')
    setAccountId(accounts[0]?.id || 'main-card')
    setEditMode(false)
    setEditingId(null)
  }

  const openNewRecord = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)

    if (isQuickAddPage) {
      window.location.hash = ''
    }
  }

  const openEditRecord = (record) => {
    setEditMode(true)
    setEditingId(record.id)
    setType(record.type)
    setCategory(record.category)
    setAccountId(record.accountId || accounts[0]?.id || 'main-card')
    setAmount(String(record.amount))
    setDate(record.date)
    setNote(record.note)
    setIsFormOpen(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      return
    }

    const record = {
      id: editMode ? editingId : Date.now(),
      type,
      category,
      accountId,
      amount: parsedAmount,
      note: note.trim() || 'No note',
      date,
    }

    setTransactions((current) => {
      if (editMode) {
        return current.map((item) => (item.id === editingId ? record : item))
      }

      return [record, ...current]
    })

    resetForm()
    closeForm()
  }

  const handleDelete = (id) => {
    const shouldDelete = window.confirm('Delete this transaction?')

    if (!shouldDelete) {
      return
    }

    setTransactions((current) => current.filter((item) => item.id !== id))
  }

  const handleAddCategory = (event) => {
    event.preventDefault()
    const categoryName = newCategory.trim()

    if (!categoryName || userCategories.some((item) => item.toLowerCase() === categoryName.toLowerCase())) {
      return
    }

    setUserCategories((current) => [...current, categoryName])
    setNewCategory('')
  }

  const startCategoryEdit = (categoryName) => {
    setEditingCategory(categoryName)
    setCategoryDraft(categoryName)
  }

  const saveCategoryEdit = () => {
    const nextName = categoryDraft.trim()

    if (!editingCategory || !nextName || userCategories.some((item) => item !== editingCategory && item.toLowerCase() === nextName.toLowerCase())) {
      return
    }

    setUserCategories((current) => current.map((item) => (item === editingCategory ? nextName : item)))
    setTransactions((current) => current.map((item) => (item.category === editingCategory ? { ...item, category: nextName } : item)))
    setFilterCategory((current) => (current === editingCategory ? nextName : current))
    setCategory((current) => (current === editingCategory ? nextName : current))
    setEditingCategory(null)
    setCategoryDraft('')
  }

  const handleDeleteCategory = (categoryName) => {
    const shouldDelete = window.confirm(`Delete the category "${categoryName}"? Existing transactions will move to Other.`)

    if (!shouldDelete) {
      return
    }

    setUserCategories((current) => current.filter((item) => item !== categoryName))
    setTransactions((current) => current.map((item) => (item.category === categoryName ? { ...item, category: 'Other' } : item)))
    setFilterCategory((current) => (current === categoryName ? 'All' : current))
    setCategory((current) => (current === categoryName ? 'Other' : current))
  }

  const handleAddAccount = (event) => {
    event.preventDefault()
    const accountName = newAccount.trim()

    if (!accountName || accounts.some((item) => item.name.toLowerCase() === accountName.toLowerCase())) return

    const nextAccount = { id: `card-${Date.now()}`, name: accountName, balance: 0 }
    setAccounts((current) => [...current, nextAccount])
    setNewAccount('')
  }

  const saveAccountEdit = () => {
    const nextName = accountDraft.trim()
    if (!editingAccountId || !nextName || accounts.some((item) => item.id !== editingAccountId && item.name.toLowerCase() === nextName.toLowerCase())) return

    setAccounts((current) => current.map((item) => (item.id === editingAccountId ? { ...item, name: nextName } : item)))
    setEditingAccountId(null)
    setAccountDraft('')
  }

  const handleDeleteAccount = (accountToDelete) => {
    if (accounts.length === 1) return
    if (!window.confirm(`Delete the card "${accountToDelete.name}"? Its transactions will move to the first card.`)) return

    const fallbackAccount = accounts.find((item) => item.id !== accountToDelete.id)
    setTransactions((current) => current.map((item) => (item.accountId === accountToDelete.id ? { ...item, accountId: fallbackAccount.id } : item)))
    setAccounts((current) => current.filter((item) => item.id !== accountToDelete.id))
    setSelectedAccountId((current) => (current === accountToDelete.id ? 'all' : current))
    setAccountId((current) => (current === accountToDelete.id ? fallbackAccount.id : current))
  }

  const updateAccountBalance = (accountIdToUpdate, value) => {
    setAccounts((current) => current.map((item) => (
      item.id === accountIdToUpdate ? { ...item, balance: Number(value) || 0 } : item
    )))
  }

  const navigateTo = (sectionId) => {
    setIsMenuOpen(false)
    setSelectedDayKey(null)
    setActivePage(sectionId)
  }

  const openMonth = (monthKey) => {
    setSelectedMonthKey(monthKey)
    setSelectedDayKey(null)
    setActivePage('month')
  }

  const toggleDay = (dayKey, hasRecords) => {
    if (!hasRecords) {
      return
    }

    setSelectedDayKey((current) => (current === dayKey ? null : dayKey))
  }

  return (
    <div className={isQuickAddPage ? 'app-shell quick-add-page' : 'app-shell'}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Finance Tracker</p>
          <h1>{activePage === 'analytics' ? 'Analytics' : activePage === 'settings' ? 'Settings' : activePage === 'archive' ? 'Monthly archive' : activePage === 'month' ? 'Month details' : 'My balance'}</h1>
        </div>
        <div className="menu-wrap">
          <button
            type="button"
            className="mini-button"
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <span className="menu-icon" aria-hidden="true">☰</span>
          </button>

          {isMenuOpen && (
            <div className="app-menu">
              <button type="button" onClick={() => navigateTo('balance')}>
                <span className="app-menu-icon" aria-hidden="true">⌂</span>
                <span>My balance</span>
              </button>
              <button type="button" onClick={() => navigateTo('analytics')}>
                <span className="app-menu-icon" aria-hidden="true">◔</span>
                <span>Analytics</span>
              </button>
              <button type="button" onClick={() => navigateTo('settings')}>
                <span className="app-menu-icon" aria-hidden="true">⚙︎</span>
                <span>Settings</span>
              </button>
              <button type="button" onClick={() => navigateTo('archive')}>
                <span className="app-menu-icon" aria-hidden="true">▦</span>
                <span>Monthly archive</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="content">
        <section className={activePage === 'balance' ? 'filter-panel' : 'filter-panel hidden-panel'}>
          <div className="period-toggle">
            <button type="button" className={period === 'all' ? 'filter-button active' : 'filter-button'} onClick={() => setPeriod('all')}>
              All
            </button>
            <button type="button" className={period === 'week' ? 'filter-button active' : 'filter-button'} onClick={() => setPeriod('week')}>
              Last week
            </button>
            <button type="button" className={period === 'month' ? 'filter-button active' : 'filter-button'} onClick={() => setPeriod('month')}>
              Last month
            </button>
          </div>

          <label className="category-filter">
            Category
            <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
              {['All', ...userCategories].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="category-filter">
            Bank card
            <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
              <option value="all">All cards</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </section>

        <section id="analytics-section" className={activePage === 'analytics' ? 'analytics-panel' : 'analytics-panel hidden-panel'}>
          <div className="analytics-heading">
            <div>
              <p className="eyebrow">Analytics</p>
              <h2>Where your money goes</h2>
              <p>See which categories take the biggest part of your expenses.</p>
            </div>
            <strong className="analytics-total">{formatMoney(summary.expense)} ₸</strong>
          </div>

          <div className="analytics-filter" aria-label="Analytics period filter">
            <span>Period</span>
            <div className="analytics-period-buttons">
              <button type="button" className={period === 'all' ? 'filter-button active' : 'filter-button'} onClick={() => setPeriod('all')}>
                All
              </button>
              <button type="button" className={period === 'week' ? 'filter-button active' : 'filter-button'} onClick={() => setPeriod('week')}>
                Last week
              </button>
              <button type="button" className={period === 'month' ? 'filter-button active' : 'filter-button'} onClick={() => setPeriod('month')}>
                Last month
              </button>
            </div>
          </div>

          {spendingBreakdown.length > 0 ? (
            <>
              <div className="donut-layout">
                <div className="donut-chart" style={{ background: donutGradient }}>
                  <div className="donut-hole">
                    <strong>{formatMoney(summary.expense)}</strong>
                    <span>Total expense</span>
                  </div>
                </div>
                <div className="donut-legend">
                  {spendingBreakdown.map((item, index) => (
                    <div key={item.category} className="donut-legend-row">
                      <span className="donut-legend-label">
                        <i style={{ background: chartColors[index % chartColors.length] }}></i>
                        {item.category}
                      </span>
                      <strong>{item.percent}%</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="top-expense">
                <span>Most spending</span>
                <strong>{spendingBreakdown[0].category}</strong>
                <small>{formatMoney(spendingBreakdown[0].total)} ₸ · {spendingBreakdown[0].percent}% of expenses</small>
              </div>

              <div className="analytics-list">
                {spendingBreakdown.map((item) => (
                  <div key={item.category} className="analytics-row">
                    <div className="analytics-row-header">
                      <span>{item.category}</span>
                      <strong>{formatMoney(item.total)} ₸</strong>
                    </div>
                    <div className="analytics-bar-track">
                      <span className="analytics-bar" style={{ width: `${item.percent}%` }}></span>
                    </div>
                    <small>{item.percent}% of expenses</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-analytics">No expenses for this filter yet.</p>
          )}
        </section>

        <section id="balance-section" className={activePage === 'balance' ? 'balance-card' : 'balance-card hidden-panel'}>
          <span className="label">Available balance</span>
          <strong className="balance-value">{formatMoney(summary.balance)} ₸</strong>
        </section>

        <section className={activePage === 'balance' ? 'stats-grid' : 'stats-grid hidden-panel'}>
          <div className="stat-box income">
            <span>Income</span>
            <strong>{formatMoney(summary.income)} ₸</strong>
          </div>
          <div className="stat-box expense">
            <span>Expense</span>
            <strong>{formatMoney(summary.expense)} ₸</strong>
          </div>
        </section>

        <section className={activePage === 'balance' ? 'section-header' : 'section-header hidden-panel'}>
          <h2>Recent activity</h2>
        </section>

        <section className={activePage === 'balance' ? 'transaction-list' : 'transaction-list hidden-panel'}>
          {filteredTransactions.map((item) => (
            <article key={item.id} className="transaction-item">
              <div className="transaction-main">
                <span className={`type-badge ${item.type}`}>
                  {item.type === 'income' ? 'Income' : 'Expense'}
                </span>
                <div>
                  <h3>{item.category}</h3>
                  <p>{item.note}</p>
                  <small className="transaction-account">{accounts.find((account) => account.id === item.accountId)?.name || 'Main card'}</small>
                </div>
              </div>

              <div className="transaction-side">
                <strong className={item.type === 'income' ? 'income-text' : 'expense-text'}>
                  {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)} ₸
                </strong>
                <small>{item.date}</small>
                <div className="action-row">
                  <button type="button" className="edit-button" onClick={() => openEditRecord(item)}>Edit</button>
                  <button type="button" className="delete-button" onClick={() => handleDelete(item.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className={activePage === 'settings' ? 'settings-panel' : 'settings-panel hidden-panel'}>
          <div className="settings-heading">
            <div>
              <p className="eyebrow">Settings</p>
              <h2>Expense categories</h2>
              <p>Add, rename, or remove the categories used in your records.</p>
            </div>
          </div>

          <div className="account-settings-block">
            <div className="settings-subheading">
              <strong>Bank cards</strong>
              <span>Keep each card balance separate.</span>
            </div>

            <form className="category-add-form" onSubmit={handleAddAccount}>
              <input
                type="text"
                value={newAccount}
                placeholder="New bank card"
                onChange={(event) => setNewAccount(event.target.value)}
              />
              <button type="submit">Add</button>
            </form>

            <div className="category-settings-list">
              {accounts.map((item) => (
                <div key={item.id} className="category-settings-row">
                  {editingAccountId === item.id ? (
                    <input
                      className="category-edit-input"
                      value={accountDraft}
                      autoFocus
                      onChange={(event) => setAccountDraft(event.target.value)}
                    />
                  ) : (
                    <div className="account-row-label">
                      <span>{item.name}</span>
                      <label className="account-balance-input">
                        <span>₸</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.balance}
                          onChange={(event) => updateAccountBalance(item.id, event.target.value)}
                        />
                      </label>
                    </div>
                  )}

                  <div className="category-settings-actions">
                    {editingAccountId === item.id ? (
                      <>
                        <button type="button" className="category-save" onClick={saveAccountEdit}>Save</button>
                        <button type="button" className="category-cancel" onClick={() => setEditingAccountId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="category-edit" onClick={() => { setEditingAccountId(item.id); setAccountDraft(item.name) }}>Edit</button>
                        <button type="button" className="category-remove" onClick={() => handleDeleteAccount(item)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form className="category-add-form" onSubmit={handleAddCategory}>
            <input
              type="text"
              value={newCategory}
              placeholder="New category"
              onChange={(event) => setNewCategory(event.target.value)}
            />
            <button type="submit">Add</button>
          </form>

          <div className="category-settings-list">
            {userCategories.map((categoryName) => (
              <div key={categoryName} className="category-settings-row">
                {editingCategory === categoryName ? (
                  <input
                    className="category-edit-input"
                    value={categoryDraft}
                    autoFocus
                    onChange={(event) => setCategoryDraft(event.target.value)}
                  />
                ) : (
                  <span>{categoryName}</span>
                )}

                <div className="category-settings-actions">
                  {editingCategory === categoryName ? (
                    <>
                      <button type="button" className="category-save" onClick={saveCategoryEdit}>Save</button>
                      <button type="button" className="category-cancel" onClick={() => setEditingCategory(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="category-edit" onClick={() => startCategoryEdit(categoryName)}>Edit</button>
                      <button type="button" className="category-remove" onClick={() => handleDeleteCategory(categoryName)}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={activePage === 'archive' ? 'archive-panel' : 'archive-panel hidden-panel'}>
          <div className="archive-heading">
            <p className="eyebrow">History</p>
            <h2>Monthly expenses</h2>
            <p>Every year, month, and day is collected in one place.</p>
          </div>

          {monthlyArchive.length > 0 ? monthlyArchive.map((yearGroup) => (
            <div key={yearGroup.year} className="archive-year-group">
              <h3>{yearGroup.year}</h3>
              <div className="archive-month-list">
                {yearGroup.months.map((monthGroup) => {
                  const monthTransactions = Object.values(monthGroup.days).flat()
                  const monthExpense = monthTransactions
                    .filter((item) => item.type === 'expense')
                    .reduce((sum, item) => sum + Number(item.amount), 0)
                  const monthIncome = monthTransactions
                    .filter((item) => item.type === 'income')
                    .reduce((sum, item) => sum + Number(item.amount), 0)
                  const monthKey = `${yearGroup.year}-${monthGroup.month}`

                  return (
                    <article
                      key={monthKey}
                      className="month-card"
                      role="button"
                      tabIndex="0"
                      onClick={() => openMonth(monthKey)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          openMonth(monthKey)
                        }
                      }}
                    >
                      <div className="month-card-header">
                        <div>
                          <h4>{monthGroup.monthName}</h4>
                          <span>{monthTransactions.length} records</span>
                        </div>
                        <div className="month-card-summary">
                          <span className="month-chevron">›</span>
                        </div>
                      </div>

                      <div className="month-card-metrics">
                        <div className="month-metric">
                          <span>Spent</span>
                          <strong className="month-expense">-{formatMoney(monthExpense)} ₸</strong>
                        </div>
                        <div className="month-metric">
                          <span>Received</span>
                          <strong className="month-income">+{formatMoney(monthIncome)} ₸</strong>
                        </div>
                      </div>

                      <div className="day-grid collapsed">
                        {Array.from({ length: 31 }, (_, index) => {
                          const day = String(index + 1).padStart(2, '0')
                          const dayTransactions = monthGroup.days[day] || []
                          const dayExpense = dayTransactions
                            .filter((item) => item.type === 'expense')
                            .reduce((sum, item) => sum + Number(item.amount), 0)
                          const dayIncome = dayTransactions
                            .filter((item) => item.type === 'income')
                            .reduce((sum, item) => sum + Number(item.amount), 0)

                          return (
                            <button
                              key={day}
                              type="button"
                              className={dayTransactions.length ? 'day-cell has-records' : 'day-cell'}
                              onClick={() => toggleDay(`${monthKey}-${day}`, dayTransactions.length > 0)}
                              aria-label={`${monthGroup.monthName} ${index + 1}`}
                            >
                              <span className="day-number">{index + 1}</span>
                              {dayTransactions.length > 0 && (
                                <div className="day-details">
                                  {dayExpense > 0 && <small className="day-expense">-{formatMoney(dayExpense)} ₸</small>}
                                  {dayIncome > 0 && <small className="day-income">+{formatMoney(dayIncome)} ₸</small>}
                                  <span>{dayTransactions.length} item{dayTransactions.length > 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {activePage === 'month' && selectedDayKey?.startsWith(`${monthKey}-`) && (
                        <div className="day-history">
                          <div className="day-history-heading">
                            <strong>{monthGroup.monthName} {Number(selectedDayKey.split('-').pop())}</strong>
                            <span>History</span>
                          </div>
                          {(monthGroup.days[selectedDayKey.split('-').pop()] || []).map((item) => (
                            <div key={item.id} className="day-history-row">
                              <div>
                                <strong>{item.category}</strong>
                                <small>{item.note}</small>
                              </div>
                              <strong className={item.type === 'income' ? 'income-text' : 'expense-text'}>
                                {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)} ₸
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
          )) : (
            <p className="empty-analytics">No saved records yet.</p>
          )}
        </section>

        <section className={activePage === 'month' ? 'archive-panel month-detail-panel' : 'archive-panel hidden-panel'}>
          <button type="button" className="back-to-archive" onClick={() => { setSelectedDayKey(null); setActivePage('archive') }}>
            ‹ Monthly archive
          </button>

          {monthlyArchive.flatMap((yearGroup) => yearGroup.months.map((monthGroup) => ({
            ...monthGroup,
            year: yearGroup.year,
            key: `${yearGroup.year}-${monthGroup.month}`,
          }))).filter((monthGroup) => monthGroup.key === selectedMonthKey).map((monthGroup) => {
            const monthTransactions = Object.values(monthGroup.days).flat()
            const monthExpense = monthTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
            const monthIncome = monthTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0)

            return (
              <div key={monthGroup.key}>
                <div className="month-detail-heading">
                  <div>
                    <p className="eyebrow">{monthGroup.year}</p>
                    <h2>{monthGroup.monthName}</h2>
                  </div>
                  <div className="month-card-summary">
                    <strong className="month-expense">-{formatMoney(monthExpense)} ₸</strong>
                    <strong className="month-income">+{formatMoney(monthIncome)} ₸</strong>
                  </div>
                </div>

                <div className="day-grid month-detail-grid">
                  {Array.from({ length: 31 }, (_, index) => {
                    const day = String(index + 1).padStart(2, '0')
                    const dayTransactions = monthGroup.days[day] || []
                    const dayExpense = dayTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
                    const dayIncome = dayTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0)
                    const dayKey = `${monthGroup.key}-${day}`

                    return (
                      <button key={day} type="button" className={dayTransactions.length ? 'day-cell has-records' : 'day-cell'} onClick={() => toggleDay(dayKey, dayTransactions.length > 0)}>
                        <span className="day-number">{index + 1}</span>
                        {dayTransactions.length > 0 && (
                          <div className="day-details">
                            {dayExpense > 0 && <small className="day-expense">-{formatMoney(dayExpense)} ₸</small>}
                            {dayIncome > 0 && <small className="day-income">+{formatMoney(dayIncome)} ₸</small>}
                            <span>{dayTransactions.length} item{dayTransactions.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {selectedDayKey?.startsWith(`${monthGroup.key}-`) && (
                  <div className="day-history">
                    <div className="day-history-heading">
                      <strong>{monthGroup.monthName} {Number(selectedDayKey.split('-').pop())}</strong>
                      <span>History</span>
                    </div>
                    {(monthGroup.days[selectedDayKey.split('-').pop()] || []).map((item) => (
                      <div key={item.id} className="day-history-row">
                        <div>
                          <strong>{item.category}</strong>
                          <small>{item.note}</small>
                        </div>
                        <strong className={item.type === 'income' ? 'income-text' : 'expense-text'}>
                          {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)} ₸
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      </main>

      {isFormOpen && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit record' : isQuickAddPage ? 'Quick expense' : 'New record'}</h2>
              <button type="button" className="close-button" onClick={closeForm}>×</button>
            </div>

            <form className="expense-form" onSubmit={handleSubmit}>
              <div className="toggle-row">
                <button type="button" className={type === 'expense' ? 'toggle active expense' : 'toggle'} onClick={() => setType('expense')}>Expense</button>
                <button type="button" className={type === 'income' ? 'toggle active income' : 'toggle'} onClick={() => setType('income')}>Income</button>
              </div>

              <label>
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {userCategories.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                Bank card
                <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  {accounts.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Sum
                <input type="number" min="1" step="1" inputMode="numeric" pattern="[0-9]*" placeholder="5000" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>

              <label>
                Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>

              <label>
                Note
                <input type="text" placeholder="Lunch, salary, rent..." value={note} onChange={(event) => setNote(event.target.value)} />
              </label>

              <button type="submit" className="save-button">
                {editMode ? 'Update record' : 'Save record'}
              </button>
            </form>
          </div>
        </div>
      )}

      <button type="button" className="fab" onClick={openNewRecord}>+</button>
    </div>
  )
}

export default App