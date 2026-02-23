import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAnalyticsAggregates } from "./useAnalyticsOrders";
import "./Analytics.css";

export function Analytics() {
  const {
    dailyAggregates,
    loading,
    error,
    fetchAggregatesForRange,
    isFirestoreEnabled,
  } = useAnalyticsAggregates();

  // DEBUG: Component mounted alert - ALWAYS SHOWS
  useEffect(() => {
    alert(
      "🚀 ANALYTICS COMPONENT LOADED\n\n" +
        `This alert confirms the debug code is running.\n` +
        `Firestore Enabled: ${isFirestoreEnabled}\n` +
        `Initial Loading State: ${loading}\n` +
        `Initial Aggregates Count: ${dailyAggregates.length}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array = runs once on mount

  // Date range state
  const [dateRange, setDateRange] = useState<
    "today" | "week" | "month" | "ytd" | "custom"
  >("today");

  // Set default custom dates to last 90 days
  const getDefaultCustomDates = () => {
    // Get current date in Turkish timezone
    const now = new Date();
    const turkishToday = new Date(
      now.toLocaleString("en-US", {
        timeZone: "Europe/Istanbul",
      }),
    );

    const today = new Date(
      turkishToday.getFullYear(),
      turkishToday.getMonth(),
      turkishToday.getDate(),
    );

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 89); // 90 days including today

    return {
      start: startDate.toISOString().split("T")[0],
      end: today.toISOString().split("T")[0],
    };
  };

  const defaultDates = getDefaultCustomDates();
  const [customStartDate, setCustomStartDate] = useState(defaultDates.start);
  const [customEndDate, setCustomEndDate] = useState(defaultDates.end);

  // Calculate date range
  const getDateRange = (): { startDate: string; endDate: string } => {
    // Get current date in Turkish timezone (Europe/Istanbul)
    const now = new Date();
    const turkishDate = new Date(
      now.toLocaleString("en-US", {
        timeZone: "Europe/Istanbul",
      }),
    );

    // Format as YYYY-MM-DD
    const today = new Date(
      turkishDate.getFullYear(),
      turkishDate.getMonth(),
      turkishDate.getDate(),
    );

    let startDate = new Date(today);
    const endDate = new Date(today);

    switch (dateRange) {
      case "today":
        // Today only
        break;
      case "week":
        // Last 7 days
        startDate.setDate(today.getDate() - 6);
        break;
      case "month":
        // Last 30 days
        startDate.setDate(today.getDate() - 29);
        break;
      case "ytd": {
        // Year-to-date (January 1 to today)
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return {
          startDate: yearStart.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        };
      }
      case "custom": {
        if (customStartDate && customEndDate) {
          return {
            startDate: customStartDate,
            endDate: customEndDate,
          };
        }
        // Fallback to last 90 days if custom dates not set
        const fallbackStart = new Date(today);
        fallbackStart.setDate(today.getDate() - 89);
        return {
          startDate: fallbackStart.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        };
      }
    }

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };
  };

  // Fetch data when date range changes
  useEffect(() => {
    if (isFirestoreEnabled) {
      const { startDate, endDate } = getDateRange();
      fetchAggregatesForRange(startDate, endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customStartDate, customEndDate, isFirestoreEnabled]);

  // DEBUG ALERT - Show Firestore data when it arrives
  useEffect(() => {
    if (!loading && dailyAggregates.length > 0) {
      const { startDate, endDate } = getDateRange();
      const dataPreview = dailyAggregates.slice(0, 3).map((agg) => ({
        date: agg.date,
        totalRevenue: agg.totalRevenue,
        totalOrders: agg.totalOrders,
        cashRevenue: agg.cashRevenue,
        cardRevenue: agg.cardRevenue,
        itemCountsKeys: Object.keys(agg.itemCounts || {}),
      }));

      alert(
        "📦 FIRESTORE DATA LOADED - Screenshot this!\n\n" +
          `Date Range: ${startDate} to ${endDate}\n` +
          `Total Aggregates: ${dailyAggregates.length}\n` +
          `Firestore Enabled: ${isFirestoreEnabled}\n` +
          `\nFirst 3 Days Preview:\n` +
          JSON.stringify(dataPreview, null, 2) +
          `\n\nFull First Aggregate:\n` +
          JSON.stringify(dailyAggregates[0], null, 2),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyAggregates, loading]);

  // Helper function to format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Helper function to format currency
  const formatCurrency = (value: number) => {
    return value.toFixed(2);
  };

  // CSV Export functionality
  const exportToCSV = () => {
    const { startDate, endDate } = getDateRange();

    // CSV Header
    const headers = [
      "Tarih",
      "Toplam Sipariş",
      "Toplam Gelir (TL)",
      "Nakit Sipariş",
      "Nakit Gelir (TL)",
      "Kart Sipariş",
      "Kart Gelir (TL)",
      "En Çok Satılan Ürünler",
    ];

    // Create a map of existing data
    const dataMap = new Map(dailyAggregates.map((day) => [day.date, day]));

    // Generate all dates in range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const rows: Array<Array<string | number>> = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const existingData = dataMap.get(dateStr);

      const topItems = existingData
        ? Object.entries(existingData.itemCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([product, quantity]) => `${product} (${quantity})`)
            .join("; ")
        : "";

      rows.push([
        dateStr,
        existingData?.totalOrders || 0,
        formatCurrency(existingData?.totalRevenue || 0),
        existingData?.cashOrders || 0,
        formatCurrency(existingData?.cashRevenue || 0),
        existingData?.cardOrders || 0,
        formatCurrency(existingData?.cardRevenue || 0),
        topItems,
      ]);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add summary row
    const summaryRow = [
      "TOPLAM",
      totalOrders,
      formatCurrency(totalRevenue),
      totalCash,
      formatCurrency(cashRevenue),
      totalCard,
      formatCurrency(cardRevenue),
      "",
    ];

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      summaryRow.map((cell) => `"${cell}"`).join(","),
    ].join("\n");

    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    // Create download link
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gato-analytics-${startDate}-${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate overall statistics from aggregates
  const totalRevenue = dailyAggregates.reduce(
    (sum, day) => sum + day.totalRevenue,
    0,
  );
  const totalOrders = dailyAggregates.reduce(
    (sum, day) => sum + day.totalOrders,
    0,
  );
  const cashRevenue = dailyAggregates.reduce(
    (sum, day) => sum + day.cashRevenue,
    0,
  );
  const cardRevenue = dailyAggregates.reduce(
    (sum, day) => sum + day.cardRevenue,
    0,
  );
  const totalCash = dailyAggregates.reduce(
    (sum, day) => sum + day.cashOrders,
    0,
  );
  const totalCard = dailyAggregates.reduce(
    (sum, day) => sum + day.cardOrders,
    0,
  );

  // DEBUG ALERT - Show diagnostic info for Turkey users
  useEffect(() => {
    const debugInfo = {
      dailyAggregatesCount: dailyAggregates.length,
      totalRevenue,
      totalOrders,
      cashRevenue,
      cardRevenue,
      totalCash,
      totalCard,
      dateRange,
      isFirestoreEnabled,
      loading,
      error,
      sampleAggregate: dailyAggregates[0] || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
    };

    // Show alert only if we have a problem (all zeros but not loading)
    if (
      !loading &&
      dailyAggregates.length > 0 &&
      totalRevenue === 0 &&
      totalOrders === 0
    ) {
      alert(
        "🐛 DEBUG INFO - Screenshot this!\n\n" +
          `Aggregates Count: ${debugInfo.dailyAggregatesCount}\n` +
          `Total Revenue: ${debugInfo.totalRevenue}\n` +
          `Total Orders: ${debugInfo.totalOrders}\n` +
          `Cash Revenue: ${debugInfo.cashRevenue}\n` +
          `Card Revenue: ${debugInfo.cardRevenue}\n` +
          `Date Range: ${debugInfo.dateRange}\n` +
          `Firestore Enabled: ${debugInfo.isFirestoreEnabled}\n` +
          `Loading: ${debugInfo.loading}\n` +
          `Error: ${debugInfo.error || "none"}\n` +
          `Sample Aggregate: ${JSON.stringify(debugInfo.sampleAggregate, null, 2)}\n` +
          `Timezone: ${debugInfo.timezone}\n` +
          `Locale: ${debugInfo.locale}`,
      );
    }

    console.log("🐛 Analytics Debug Info:", debugInfo);
  }, [
    totalRevenue,
    totalOrders,
    dailyAggregates,
    dateRange,
    isFirestoreEnabled,
    loading,
    error,
    cashRevenue,
    cardRevenue,
    totalCash,
    totalCard,
  ]);

  // Chart data - fill in missing dates for continuous display
  const getChartData = () => {
    const { startDate, endDate } = getDateRange();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Create a map of existing data
    const dataMap = new Map(dailyAggregates.map((day) => [day.date, day]));

    // Generate all dates in range
    const allDates: Array<{
      date: string;
      totalRevenue: number;
      totalOrders: number;
    }> = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const existingData = dataMap.get(dateStr);

      allDates.push({
        date: dateStr,
        totalRevenue: existingData?.totalRevenue || 0,
        totalOrders: existingData?.totalOrders || 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allDates;
  };

  const chartData = getChartData();

  // Payment method distribution
  const paymentData = [
    { name: "Nakit", value: totalCash, fill: "#4caf50" },
    { name: "Kart", value: totalCard, fill: "#2196f3" },
  ];

  // Top products from aggregates
  const allProducts: Record<string, number> = {};
  dailyAggregates.forEach((day) => {
    Object.entries(day.itemCounts).forEach(([product, quantity]) => {
      allProducts[product] = (allProducts[product] || 0) + quantity;
    });
  });

  const topProducts = Object.entries(allProducts)
    .map(([product, quantity]) => ({ product, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return (
    <div className="analytics-container">
      <h2 className="page-title">Analytics & İstatistikler</h2>
      {/* DEBUG PANEL - VISIBLE IN UI */}
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          backgroundColor: "#ff6b6b",
          color: "white",
          padding: "20px",
          borderRadius: "10px",
          maxWidth: "400px",
          maxHeight: "80vh",
          overflow: "auto",
          zIndex: 9999,
          fontSize: "12px",
          fontFamily: "monospace",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
          🐛 DEBUG INFO - Screenshot This!
        </h3>
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          <strong>Firestore Status:</strong>{" "}
          {isFirestoreEnabled ? "✅ Enabled" : "❌ Disabled"}
          <br />
          <strong>Loading:</strong> {loading ? "⏳ Yes" : "✅ No"}
          <br />
          <strong>Error:</strong> {error || "None"}
          <br />
          <strong>Date Range:</strong> {dateRange}
          <br />
          <strong>Aggregates Count:</strong> {dailyAggregates.length}
          <br />
          <strong>Total Revenue:</strong> {totalRevenue.toFixed(2)} TL
          <br />
          <strong>Total Orders:</strong> {totalOrders}
          <br />
          <strong>Cash Revenue:</strong> {cashRevenue.toFixed(2)} TL
          <br />
          <strong>Card Revenue:</strong> {cardRevenue.toFixed(2)} TL
          <br />
          <strong>Timezone:</strong>{" "}
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
          <br />
          <strong>Locale:</strong> {navigator.language}
          <br />
          <br />
          <strong>First Aggregate Sample:</strong>
          <br />
          {dailyAggregates.length > 0 ? (
            <pre style={{ fontSize: "10px", margin: "5px 0" }}>
              {JSON.stringify(dailyAggregates[0], null, 2)}
            </pre>
          ) : (
            "No data"
          )}
        </div>
      </div>
      {/* Date Range Filter */}
      <div className="date-filter-container">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${dateRange === "today" ? "active" : ""}`}
            onClick={() => setDateRange("today")}
          >
            Bugün
          </button>
          <button
            className={`filter-btn ${dateRange === "week" ? "active" : ""}`}
            onClick={() => setDateRange("week")}
          >
            Son 7 Gün
          </button>
          <button
            className={`filter-btn ${dateRange === "month" ? "active" : ""}`}
            onClick={() => setDateRange("month")}
          >
            Son 30 Gün
          </button>
          <button
            className={`filter-btn ${dateRange === "ytd" ? "active" : ""}`}
            onClick={() => setDateRange("ytd")}
          >
            Bu Yıl
          </button>
          <button
            className={`filter-btn ${dateRange === "custom" ? "active" : ""}`}
            onClick={() => setDateRange("custom")}
          >
            Özel Tarih
          </button>
        </div>

        {dateRange === "custom" && (
          <div className="custom-date-inputs">
            <label>
              Başlangıç:
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  setCustomStartDate(newStartDate);

                  // Validate 186-day maximum
                  if (customEndDate && newStartDate) {
                    const start = new Date(newStartDate);
                    const end = new Date(customEndDate);
                    const diffDays = Math.floor(
                      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
                    );

                    if (diffDays > 185) {
                      alert(
                        "Maksimum 186 günlük tarih aralığı seçebilirsiniz.",
                      );
                      // Set end date to 185 days from start
                      const maxEndDate = new Date(start);
                      maxEndDate.setDate(start.getDate() + 185);
                      setCustomEndDate(maxEndDate.toISOString().split("T")[0]);
                    }
                  }
                }}
              />
            </label>
            <label>
              Bitiş:
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  const newEndDate = e.target.value;
                  setCustomEndDate(newEndDate);

                  // Validate 186-day maximum
                  if (customStartDate && newEndDate) {
                    const start = new Date(customStartDate);
                    const end = new Date(newEndDate);
                    const diffDays = Math.floor(
                      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
                    );

                    if (diffDays > 185) {
                      alert(
                        "Maksimum 186 günlük tarih aralığı seçebilirsiniz.",
                      );
                      // Set start date to 185 days before end
                      const maxStartDate = new Date(end);
                      maxStartDate.setDate(end.getDate() - 185);
                      setCustomStartDate(
                        maxStartDate.toISOString().split("T")[0],
                      );
                    }
                  }
                }}
              />
            </label>
          </div>
        )}

        {/* Export Button */}
        <button
          className="export-btn"
          onClick={exportToCSV}
          disabled={dailyAggregates.length === 0}
        >
          📊 CSV İndir
        </button>
      </div>
      {loading && <div className="loading-state">Yükleniyor...</div>}
      {error && <div className="error-state">{error}</div>}
      {/* Overall Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Toplam Sipariş</div>
          <div className="stat-value">{totalOrders}</div>
        </div>
        <div className="stat-card stat-card-large">
          <div className="stat-label">Toplam Gelir</div>
          <div className="stat-value">{formatCurrency(totalRevenue)} TL</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Nakit Gelir</div>
          <div className="stat-value">{formatCurrency(cashRevenue)} TL</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kart Gelir</div>
          <div className="stat-value">{formatCurrency(cardRevenue)} TL</div>
        </div>
      </div>
      {/* Charts Section */}
      {dailyAggregates.length > 0 && (
        <div className="charts-section">
          <div className="chart-container">
            <h3>Günlük Gelir Trendi</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalRevenue" fill="#2e7d32" name="Gelir (TL)" />
                <Bar
                  dataKey="totalOrders"
                  fill="#1976d2"
                  name="Sipariş Sayısı"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>Ödeme Yöntemi Dağılımı</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container full-width">
            <h3>En Çok Satılan Ürünler (Top 10)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="product"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#ff9800" name="Miktar" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}{" "}
      {/* Daily Breakdown */}
      {dailyAggregates.length === 0 ? (
        <p className="empty-state">
          Seçili tarih aralığında sipariş bulunmamaktadır.
        </p>
      ) : (
        <div className="daily-stats">
          {dailyAggregates.map((day) => {
            const topDayItems = Object.entries(day.itemCounts)
              .map(([product, quantity]) => ({ product, quantity }))
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 5);

            return (
              <div key={day.date} className="daily-card">
                <div className="daily-header">
                  <h3>{formatDate(day.date)}</h3>
                  <div className="daily-summary">
                    <span className="summary-badge">
                      {day.totalOrders} sipariş
                    </span>
                    <span className="summary-badge revenue">
                      {formatCurrency(day.totalRevenue)} TL
                    </span>
                  </div>
                </div>

                <div className="daily-details">
                  <div className="detail-row">
                    <span>💵 Nakit:</span>
                    <span className="detail-value">
                      {day.cashOrders} sipariş (
                      {formatCurrency(day.cashRevenue)} TL)
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>💳 Kart:</span>
                    <span className="detail-value">
                      {day.cardOrders} sipariş (
                      {formatCurrency(day.cardRevenue)} TL)
                    </span>
                  </div>
                </div>

                <div className="daily-items">
                  <h4>En Çok Satılan Ürünler:</h4>
                  {topDayItems.map((item, index) => (
                    <div key={index} className="item-row">
                      <span className="item-name">{item.product}</span>
                      <span className="item-qty">{item.quantity}x</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
