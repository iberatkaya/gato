import { useEffect, useRef, useState } from "react";
import "./App.css";
import { menuItems } from "./menu";
import { LoginPage } from "./LoginPage";
import { Analytics } from "./Analytics";
import "./Analytics.css";
import { useFirestoreOrders } from "./useFirestoreOrders";
import type { MenuItem } from "./menu";
import { TableManagement } from "./TableManagement";

interface OrderItem {
  product: string;
  price: number;
  quantity: number;
  basePrice?: number;
  modifiers?: string[];
  complimentary?: boolean;
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  paymentMethod: "cash" | "card";
  date: string;
  note?: string;
  source?: "counter" | "table";
  tableId?: number;
  tableName?: string;
  loyaltyDiscount?: boolean;
  discountAmount?: number;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("auth_token");
  });
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem("current_user") || "";
  });
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [recentlyAddedProducts, setRecentlyAddedProducts] = useState<
    Record<string, number>
  >({});
  const productAnimationTimers = useRef<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [orderNote, setOrderNote] = useState<string>("");

  useEffect(() => {
    const timers = productAnimationTimers.current;

    return () => {
      Object.values(timers).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  const triggerProductAddedAnimation = (productName: string) => {
    setRecentlyAddedProducts((prev) => ({
      ...prev,
      [productName]: (prev[productName] ?? 0) + 1,
    }));

    const existingTimer = productAnimationTimers.current[productName];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    productAnimationTimers.current[productName] = window.setTimeout(() => {
      setRecentlyAddedProducts((prev) => {
        const next = { ...prev };
        delete next[productName];
        return next;
      });
      delete productAnimationTimers.current[productName];
    }, 500);
  };

  // Use Firestore hook for orders management with localStorage fallback
  const {
    orders,
    loading: firestoreLoading,
    error: firestoreError,
    addNewOrder,
    removeOrder,
  } = useFirestoreOrders();

  const [view, setView] = useState<
    "order" | "tables" | "history" | "analytics"
  >("order");

  const addProductToOrder = (menuItem: MenuItem) => {
    triggerProductAddedAnimation(menuItem.product);

    const existingItemIndex = currentOrder.findIndex(
      (item) => item.product === menuItem.product,
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

  const placeOrder = async () => {
    if (currentOrder.length === 0) return;

    try {
      // Get current date and time in Turkish timezone (Europe/Istanbul)
      const now = new Date();

      // Get the date and time components in Turkish timezone
      const turkishDateTime = new Date(
        now.toLocaleString("en-US", {
          timeZone: "Europe/Istanbul",
        }),
      );

      // Format as YYYY-MM-DD HH:MM
      const year = turkishDateTime.getFullYear();
      const month = String(turkishDateTime.getMonth() + 1).padStart(2, "0");
      const day = String(turkishDateTime.getDate()).padStart(2, "0");
      const hours = String(turkishDateTime.getHours()).padStart(2, "0");
      const minutes = String(turkishDateTime.getMinutes()).padStart(2, "0");
      const dateTimeStr = `${year}-${month}-${day} ${hours}:${minutes}`;

      console.log("Saving order with date and time:", dateTimeStr);

      const newOrder: Omit<Order, "id"> = {
        items: [...currentOrder],
        total: calculateTotal(),
        paymentMethod,
        date: dateTimeStr,
        ...(orderNote.trim() && { note: orderNote.trim() }),
      };

      console.log("Order object:", newOrder);
      await addNewOrder(newOrder);
      setCurrentOrder([]);
      setOrderNote("");
      alert("Sipariş başarıyla kaydedildi!");
    } catch (error) {
      console.error("Error placing order:", error);
      alert("Sipariş kaydedilirken hata oluştu. Lütfen tekrar deneyin.");
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (window.confirm("Bu siparişi silmek istediğinizden emin misiniz?")) {
      try {
        await removeOrder(orderId);
      } catch (error) {
        console.error("Error deleting order:", error);
        alert("Sipariş silinirken hata oluştu. Lütfen tekrar deneyin.");
      }
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

  const orderedMenuCategories = Object.entries(groupedMenu).sort(
    ([categoryA], [categoryB]) => {
      if (categoryA === "Iced Coffees") return -1;
      if (categoryB === "Iced Coffees") return 1;
      return 0;
    },
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
        <div className="header-content">
          <h1>Gato Coffee Bar</h1>
          <div className="header-actions">
            <span className="header-user">👤 {currentUser}</span>
            <button
              onClick={handleLogout}
              className="logout-button"
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

      {firestoreError && (
        <div
          style={{
            backgroundColor: "#fef3e8",
            color: "#b56938",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "4px",
            textAlign: "center",
          }}
        >
          ⚠️ {firestoreError}
        </div>
      )}

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
          Sipariş Sistemi
        </button>
        <button
          onClick={() => setView("tables")}
          className={`toggle-button ${view === "tables" ? "active" : ""}`}
        >
          Masa Yönetimi (Beta)
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
          <div className="order-layout">
            <section className="order-panel">
              <div className="order-card">
                <h3 className="section-title order-card-title">
                  Mevcut Sipariş
                </h3>
                {currentOrder.length === 0 ? (
                  <p className="order-empty-inline">
                    Ürün eklediğinizde sipariş detayları burada görünecek.
                  </p>
                ) : (
                  <>
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
                          <span className="quantity-display">
                            {item.quantity}
                          </span>
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

                    {/* Display note preview if note exists */}
                    {orderNote.trim() && (
                      <div className="current-order-note">
                        <strong>Not:</strong> {orderNote}
                      </div>
                    )}

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

                    {/* Order Note */}
                    <div className="note-section">
                      <h4>Not (İsteğe Bağlı):</h4>
                      <textarea
                        value={orderNote}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.length <= 300) {
                            setOrderNote(value);
                          }
                        }}
                        placeholder="Sipariş ile ilgili not ekleyebilirsiniz..."
                        maxLength={300}
                        rows={2}
                        className="note-input"
                      />
                      <div className="note-counter">
                        {orderNote.length}/300 karakter
                      </div>
                    </div>

                    <button
                      onClick={placeOrder}
                      className="submit-button"
                      disabled={firestoreLoading}
                    >
                      {firestoreLoading ? "İşleniyor..." : "Siparişi Tamamla"}
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Product Selection */}
            <section className="menu-panel">
              <div className="menu-browser">
                {orderedMenuCategories.map(([category, items]) => (
                  <section key={category} className="menu-category-card">
                    <h3 className="menu-category-title">{category}</h3>
                    <div className="menu-items-grid">
                      {items.map((item) => (
                        <button
                          key={item.product}
                          type="button"
                          className={`menu-item-button ${recentlyAddedProducts[item.product] ? "added" : ""}`}
                          onClick={() => addProductToOrder(item)}
                        >
                          <span className="menu-item-name">{item.product}</span>
                          <span className="menu-item-price">
                            {item.price} TL
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : view === "tables" ? (
        <TableManagement />
      ) : view === "history" ? (
        <>
          <h2 className="page-title">Sipariş Geçmişi</h2>
          {orders.length === 0 ? (
            <p className="empty-state">Henüz sipariş bulunmamaktadır.</p>
          ) : (
            <div className="history-list">
              {orders.map((order) => {
                return (
                  <div key={order.id} className="history-item">
                    <div className="history-header">
                      <div>
                        <strong>Tarih:</strong> {order.date}
                      </div>
                      <div>
                        <strong>Ödeme:</strong>{" "}
                        {order.paymentMethod === "cash" ? "Nakit" : "Kart"}
                      </div>
                      {order.source === "table" && (
                        <div>
                          <strong>Kaynak:</strong> Masa {order.tableId ?? "-"}
                        </div>
                      )}
                    </div>

                    {order.loyaltyDiscount && (
                      <div className="history-note">
                        <strong>Loyalty:</strong> %10 indirim uygulandı
                      </div>
                    )}

                    <div className="history-items">
                      {order.items.map((item, index) => (
                        <div key={index} className="history-item-row">
                          <div>
                            {item.quantity}x {item.product} -{" "}
                            {item.price * item.quantity} TL
                            {(item.complimentary || item.modifiers?.length) && (
                              <div
                                style={{ fontSize: "0.85rem", opacity: 0.8 }}
                              >
                                {item.complimentary && (
                                  <span>Complimentary</span>
                                )}
                                {item.complimentary && item.modifiers?.length
                                  ? " · "
                                  : null}
                                {item.modifiers?.length
                                  ? item.modifiers.join(" · ")
                                  : null}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.note && (
                      <div className="history-note">
                        <strong>Not:</strong> {order.note}
                      </div>
                    )}

                    <div className="history-footer">
                      <div>
                        <strong className="history-total">
                          Toplam: {order.total} TL
                        </strong>
                        {order.discountAmount ? (
                          <div style={{ fontSize: "0.9rem", color: "#b56938" }}>
                            İndirim: -{order.discountAmount} TL
                          </div>
                        ) : null}
                      </div>
                      <button
                        onClick={() => deleteOrder(order.id)}
                        className="delete-button"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <Analytics />
      )}
    </div>
  );
}

export default App;
