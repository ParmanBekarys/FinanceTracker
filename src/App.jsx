import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'finance-tracker-mobile-v1'
const CATEGORIES_STORAGE_KEY = 'finance-tracker-categories-v1'
const BALANCE_STORAGE_KEY = 'finance-tracker-opening-balance-v1'

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

const defaultTransactions = [
  { id: 1, type: 'expense', category: 'Food', amount: 500, note: 'Lunch', date: '2026-09-16' },
  { id: 2, type: 'income', category: 'Salary', amount: 250000, note: 'Monthly salary', date: '2026-09-15' },
  { id: 3, type: 'expense', category: 'Transport', amount: 1200, note: 'Taxi', date: '2026-09-14' },
  { id: 4, type: 'expense', category: 'Bills', amount: 34000, note: 'Internet', date: '2026-09-10' },
  { id: 5, type: 'expense', category: 'Food', amount: 1200, note: 'Dinner', date: '2026-08-28' },
  { id: 6, type: 'income', category: 'Freelance', amount: 45000, note: 'Project', date: '2026-08-20' },
]

const getToday = () => new Date().toISOString().slice(0, 10)

const chartColors = ['#17805c', '#36b878', '#8bd8ad', '#bfead0', '#f2b880', '#ef8d8d', '#8bb7e8']

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

  const [openingBalance, setOpeningBalance] = useState(() => {
    const saved = localStorage.getItem(BALANCE_STORAGE_KEY)
    return saved ? Number(saved) : 0
  })

  const [type, setType] = useState('expense')
  const [category, setCategory] = useState('Food')
  const [filterCategory, setFilterCategory] = useState('All')
  const [period, setPeriod] = useState('all')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getToday)
  const [note, setNote] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activePage, setActivePage] = useState('balance')
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
  }, [transactions])

  useEffect(() => {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(userCategories))
  }, [userCategories])

  useEffect(() => {
    localStorage.setItem(BALANCE_STORAGE_KEY, String(openingBalance))
  }, [openingBalance])

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

      return isInPeriod && matchesCategory
    })
  }, [transactions, filterCategory, period])

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const expense = filteredTransactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount), 0)

    return {
      income,
      expense,
      balance: openingBalance + income - expense,
    }
  }, [filteredTransactions, openingBalance])

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
    setEditMode(false)
    setEditingId(null)
  }

  const openNewRecord = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEditRecord = (record) => {
    setEditMode(true)
    setEditingId(record.id)
    setType(record.type)
    setCategory(record.category)
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
    setIsFormOpen(false)
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

  const navigateTo = (sectionId) => {
    setIsMenuOpen(false)
    setActivePage(sectionId)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Finance Tracker</p>
          <h1>{activePage === 'analytics' ? 'Analytics' : activePage === 'settings' ? 'Settings' : 'My balance'}</h1>
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
                <span className="app-menu-icon" aria-hidden="true">⚙</span>
                <span>Settings</span>
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

          <div className="opening-balance-setting">
            <div>
              <strong>Available balance</strong>
              <p>Set the amount you already have before adding transactions.</p>
            </div>
            <label className="balance-input-wrap">
              <span>₸</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={openingBalance}
                onChange={(event) => setOpeningBalance(Number(event.target.value) || 0)}
              />
            </label>
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
      </main>

      {isFormOpen && (
        <div className="modal-backdrop" onClick={() => setIsFormOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit record' : 'New record'}</h2>
              <button type="button" className="close-button" onClick={() => setIsFormOpen(false)}>×</button>
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