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

interface OrderItem {
  product: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  paymentMethod: "cash" | "card";
  date: string;
}

interface AnalyticsProps {
  orders: Order[];
}

export function Analytics({ orders }: AnalyticsProps) {
  // Group orders by day
  const ordersByDay = orders.reduce(
    (acc, order) => {
      const dateOnly = order.date;
      if (!acc[dateOnly]) {
        acc[dateOnly] = [];
      }
      acc[dateOnly].push(order);
      return acc;
    },
    {} as Record<string, Order[]>,
  );

  // Calculate daily statistics
  const dailyStats = Object.entries(ordersByDay)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, dayOrders]) => {
      const totalRevenue = dayOrders.reduce(
        (sum, order) => sum + order.total,
        0,
      );
      const cashOrders = dayOrders.filter(
        (order) => order.paymentMethod === "cash",
      ).length;
      const cardOrders = dayOrders.filter(
        (order) => order.paymentMethod === "card",
      ).length;

      const items: Record<string, number> = {};
      dayOrders.forEach((order) => {
        order.items.forEach((item) => {
          items[item.product] = (items[item.product] || 0) + item.quantity;
        });
      });

      return {
        date,
        totalOrders: dayOrders.length,
        totalRevenue,
        cashOrders,
        cardOrders,
        items: Object.entries(items)
          .map(([product, quantity]) => ({ product, quantity }))
          .sort((a, b) => b.quantity - a.quantity),
      };
    });

  // Chart data - sorted chronologically for the chart display
  const chartData = [...dailyStats].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Overall statistics - calculate first with defensive checks
  const totalRevenue = orders.reduce((sum, order) => {
    const orderTotal = typeof order.total === "number" ? order.total : 0;
    return sum + orderTotal;
  }, 0);
  const totalOrders = orders.length;
  const totalCash = orders.filter(
    (order) => order.paymentMethod === "cash",
  ).length;
  const totalCard = orders.filter(
    (order) => order.paymentMethod === "card",
  ).length;

  // Revenue by payment method
  const cashRevenue = orders
    .filter((order) => order.paymentMethod === "cash")
    .reduce((sum, order) => sum + order.total, 0);
  const cardRevenue = orders
    .filter((order) => order.paymentMethod === "card")
    .reduce((sum, order) => sum + order.total, 0);

  // Payment method distribution
  const paymentData = [
    { name: "Nakit", value: totalCash, fill: "#4caf50" },
    { name: "Kart", value: totalCard, fill: "#2196f3" },
  ];

  // Top products
  const allProducts: Record<string, number> = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      allProducts[item.product] =
        (allProducts[item.product] || 0) + item.quantity;
    });
  });

  const topProducts = Object.entries(allProducts)
    .map(([product, quantity]) => ({ product, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return (
    <div className="analytics-container">
      <h2 className="page-title">Analytics & İstatistikler</h2>
      {/* Overall Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Toplam Sipariş</div>
          <div className="stat-value">{totalOrders}</div>
        </div>
        <div className="stat-card stat-card-large">
          <div className="stat-label">Toplam Gelir</div>
          <div className="stat-value">{totalRevenue} TL</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Nakit Gelir</div>
          <div className="stat-value">{cashRevenue} TL</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kart Gelir</div>
          <div className="stat-value">{cardRevenue} TL</div>
        </div>
      </div>
      {/* Charts Section */}
      {orders.length > 0 && (
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
      {dailyStats.length === 0 ? (
        <p className="empty-state">Henüz sipariş bulunmamaktadır.</p>
      ) : (
        <div className="daily-stats">
          {dailyStats.map((day) => (
            <div key={day.date} className="daily-card">
              <div className="daily-header">
                <h3>{day.date}</h3>
                <div className="daily-summary">
                  <span className="summary-badge">
                    {day.totalOrders} sipariş
                  </span>
                  <span className="summary-badge revenue">
                    {day.totalRevenue} TL
                  </span>
                </div>
              </div>

              <div className="daily-details">
                <div className="detail-row">
                  <span>💵 Nakit:</span>
                  <span className="detail-value">{day.cashOrders}</span>
                </div>
                <div className="detail-row">
                  <span>💳 Kart:</span>
                  <span className="detail-value">{day.cardOrders}</span>
                </div>
              </div>

              <div className="daily-items">
                <h4>En Çok Satılan Ürünler:</h4>
                {day.items.slice(0, 5).map((item, index) => (
                  <div key={index} className="item-row">
                    <span className="item-name">{item.product}</span>
                    <span className="item-qty">{item.quantity}x</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
