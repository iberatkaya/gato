import { useState, useEffect } from "react";
import "./App.css";
import { menuItems } from "./menu";
import { LoginPage } from "./LoginPage";
import { Analytics } from "./Analytics";
import "./Analytics.css";
import type { MenuItem } from "./menu";

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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("auth_token");
  });
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem("current_user") || "";
  });
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [orders, setOrders] = useState<Order[]>(() => {
    const savedOrders = localStorage.getItem("orders");
    return savedOrders ? JSON.parse(savedOrders) : [];
  });
  const [view, setView] = useState<"order" | "history" | "analytics">("order");

  // Save orders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("orders", JSON.stringify(orders));
  }, [orders]);

  const addProductToOrder = () => {
    if (!selectedProduct) return;

    const menuItem = menuItems.find((item) => item.product === selectedProduct);
    if (!menuItem) return;

    const existingItemIndex = currentOrder.findIndex(
      (item) => item.product === selectedProduct,
    );

    if (existingItemIndex >= 0) {
      const updatedOrder = [...currentOrder];
      updatedOrder[existingItemIndex].quantity += 1;
      setCurrentOrder(updatedOrder);
    } else {
      setCurrentOrder([
        ...currentOrder,
        {
          product: menuItem.product,
          price: menuItem.price,
          quantity: 1,
        },
      ]);
    }
    setSelectedProduct("");
  };

  const updateQuantity = (index: number, delta: number) => {
    const updatedOrder = [...currentOrder];
    updatedOrder[index].quantity += delta;

    if (updatedOrder[index].quantity <= 0) {
      updatedOrder.splice(index, 1);
    }

    setCurrentOrder(updatedOrder);
  };

  const calculateTotal = () => {
    return currentOrder.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  };

  const placeOrder = () => {
    if (currentOrder.length === 0) return;

    const newOrder: Order = {
      id: Date.now().toString(),
      items: [...currentOrder],
      total: calculateTotal(),
      paymentMethod,
      date: new Date().toLocaleString("tr-TR"),
    };

    setOrders([newOrder, ...orders]);
    setCurrentOrder([]);
    alert("Sipariş başarıyla kaydedildi!");
  };

  const deleteOrder = (orderId: string) => {
    if (window.confirm("Bu siparişi silmek istediğinizden emin misiniz?")) {
      setOrders(orders.filter((order) => order.id !== orderId));
    }
  };

  // Group menu items by category
  const groupedMenu = menuItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, MenuItem[]>,
  );

  const handleLogin = (username: string) => {
    localStorage.setItem("auth_token", "true");
    localStorage.setItem("current_user", username);
    setIsAuthenticated(true);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    setIsAuthenticated(false);
    setCurrentUser("");
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <div className="header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1>Gato Coffee Bar</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span style={{ fontSize: "0.95rem", opacity: 0.9 }}>
              👤 {currentUser}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: "8px 16px",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(255, 255, 255, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(255, 255, 255, 0.2)";
              }}
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          marginBottom: "20px",
          textAlign: "center",
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setView("order")}
          className={`toggle-button ${view === "order" ? "active" : ""}`}
        >
          Sipariş Oluştur
        </button>
        <button
          onClick={() => setView("history")}
          className={`toggle-button ${view === "history" ? "active" : ""}`}
        >
          Sipariş Geçmişi
        </button>
        <button
          onClick={() => setView("analytics")}
          className={`toggle-button ${view === "analytics" ? "active" : ""}`}
        >
          İstatistikler
        </button>
      </div>

      {view === "order" ? (
        <>
          <h2 className="page-title">Sipariş Ekranı</h2>

          {/* Product Selection */}
          <div className="product-selector">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="">Ürün Seçin...</option>
              {Object.entries(groupedMenu).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((item) => (
                    <option key={item.product} value={item.product}>
                      {item.product} - {item.price} TL
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button onClick={addProductToOrder} className="add-button">
              Ekle
            </button>
          </div>

          {/* Current Order */}
          {currentOrder.length > 0 && (
            <div className="order-card">
              <h3 className="section-title">Mevcut Sipariş</h3>
              {currentOrder.map((item, index) => (
                <div key={index} className="order-item">
                  <span className="order-item-name">{item.product}</span>
                  <div className="order-item-controls">
                    <button
                      onClick={() => updateQuantity(index, -1)}
                      className="quantity-button minus"
                    >
                      -
                    </button>
                    <span className="quantity-display">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(index, 1)}
                      className="quantity-button plus"
                    >
                      +
                    </button>
                    <span className="item-price">
                      {item.price * item.quantity} TL
                    </span>
                  </div>
                </div>
              ))}

              <div className="order-total">
                <h3>Toplam: {calculateTotal()} TL</h3>
              </div>

              {/* Payment Method */}
              <div className="payment-section">
                <h4>Ödeme Yöntemi:</h4>
                <div className="payment-buttons">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`payment-button ${paymentMethod === "cash" ? "active" : "inactive"}`}
                  >
                    Nakit Alındı
                  </button>
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`payment-button ${paymentMethod === "card" ? "active" : "inactive"}`}
                  >
                    Kart Alındı
                  </button>
                </div>
              </div>

              <button onClick={placeOrder} className="submit-button">
                Siparişi Tamamla
              </button>
            </div>
          )}
        </>
      ) : view === "history" ? (
        <>
          <h2 className="page-title">Sipariş Geçmişi</h2>
          {orders.length === 0 ? (
            <p className="empty-state">Henüz sipariş bulunmamaktadır.</p>
          ) : (
            <div className="history-list">
              {orders.map((order) => (
                <div key={order.id} className="history-item">
                  <div className="history-header">
                    <div>
                      <strong>Tarih:</strong> {order.date}
                    </div>
                    <div>
                      <strong>Ödeme:</strong>{" "}
                      {order.paymentMethod === "cash" ? "Nakit" : "Kart"}
                    </div>
                  </div>

                  <div className="history-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="history-item-row">
                        {item.quantity}x {item.product} -{" "}
                        {item.price * item.quantity} TL
                      </div>
                    ))}
                  </div>

                  <div className="history-footer">
                    <strong className="history-total">
                      Toplam: {order.total} TL
                    </strong>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="delete-button"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : view === "history" ? (
        <>
          <h2 className="page-title">Sipariş Geçmişi</h2>
          {orders.length === 0 ? (
            <p className="empty-state">Henüz sipariş bulunmamaktadır.</p>
          ) : (
            <div className="history-list">
              {orders.map((order) => (
                <div key={order.id} className="history-item">
                  <div className="history-header">
                    <div>
                      <strong>Tarih:</strong> {order.date}
                    </div>
                    <div>
                      <strong>Ödeme:</strong>{" "}
                      {order.paymentMethod === "cash" ? "Nakit" : "Kart"}
                    </div>
                  </div>

                  <div className="history-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="history-item-row">
                        {item.quantity}x {item.product} -{" "}
                        {item.price * item.quantity} TL
                      </div>
                    ))}
                  </div>

                  <div className="history-footer">
                    <strong className="history-total">
                      Toplam: {order.total} TL
                    </strong>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="delete-button"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <Analytics orders={orders} />
      )}
    </div>
  );
}

export default App;
