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
  dailyRevenueBefore?: number;
  dailyRevenueAfter?: number;
  dailyRevenueDelta?: number;
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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("card");
  const [orderNote, setOrderNote] = useState<string>("");
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [quickDiscountPercent, setQuickDiscountPercent] = useState<
    15 | 25 | null
  >(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const {
    orders,
    loading: historyLoading,
    error: firestoreError,
    hasMore,
    isHistoryLoaded,
    loadInitialOrders,
    loadMoreOrders,
    addNewOrder,
    removeOrder,
  } = useFirestoreOrders();

  const [view, setView] = useState<
    "order" | "tables" | "history" | "analytics"
  >("order");

  useEffect(() => {
    const timers = productAnimationTimers.current;

    return () => {
      Object.values(timers).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  useEffect(() => {
    if (view === "history" && !isHistoryLoaded) {
      void loadInitialOrders();
    }
  }, [isHistoryLoaded, loadInitialOrders, view]);

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

  const calculateSubtotal = () => {
    return currentOrder.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  };

  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();

    if (quickDiscountPercent) {
      return Math.min(
        subtotal,
        Math.round((subtotal * quickDiscountPercent) / 100),
      );
    }

    return Math.min(subtotal, Math.max(0, orderDiscount));
  };

  const calculateTotal = () => {
    return Math.max(0, calculateSubtotal() - calculateDiscountAmount());
  };

  const handleDiscountChange = (value: string) => {
    const sanitizedValue = value.replace(/\D/g, "");

    setQuickDiscountPercent(null);

    if (sanitizedValue === "") {
      setOrderDiscount(0);
      return;
    }

    const parsedValue = Number(sanitizedValue);
    if (Number.isNaN(parsedValue)) {
      return;
    }

    setOrderDiscount(Math.max(0, parsedValue));
  };

  const handleQuickDiscount = (percent: 15 | 25) => {
    setQuickDiscountPercent((previousPercent) =>
      previousPercent === percent ? null : percent,
    );
  };

  const placeOrder = async () => {
    if (currentOrder.length === 0 || isPlacingOrder) return;

    setIsPlacingOrder(true);

    try {
      const now = new Date();
      const turkishDateTime = new Date(
        now.toLocaleString("en-US", {
          timeZone: "Europe/Istanbul",
        }),
      );

      const year = turkishDateTime.getFullYear();
      const month = String(turkishDateTime.getMonth() + 1).padStart(2, "0");
      const day = String(turkishDateTime.getDate()).padStart(2, "0");
      const hours = String(turkishDateTime.getHours()).padStart(2, "0");
      const minutes = String(turkishDateTime.getMinutes()).padStart(2, "0");
      const dateTimeStr = `${year}-${month}-${day} ${hours}:${minutes}`;

      const finalTotal = calculateTotal();
      const appliedDiscountAmount = calculateDiscountAmount();
      const newOrder: Omit<Order, "id"> = {
        items: [...currentOrder],
        total: finalTotal,
        paymentMethod,
        date: dateTimeStr,
        ...(orderNote.trim() && { note: orderNote.trim() }),
        ...(appliedDiscountAmount > 0 && {
          discountAmount: appliedDiscountAmount,
        }),
      };

      await addNewOrder(newOrder);
      setCurrentOrder([]);
      setOrderNote("");
      setOrderDiscount(0);
      setQuickDiscountPercent(null);
      alert("Sipariş başarıyla kaydedildi!");
    } catch (error) {
      console.error("Error placing order:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error while saving order";
      alert(`Sipariş kaydedilirken hata oluştu: ${errorMessage}`);
    } finally {
      setIsPlacingOrder(false);
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

  const priorityCategoryOrder = [
    "Iced Coffees",
    "Hot Coffees",
    "Water / Su",
    "Bakery & Desserts",
    "Espresso Bar",
    "Brew Bar",
  ];

  const priorityCategoryIndex = new Map(
    priorityCategoryOrder.map((category, index) => [category, index]),
  );

  const orderedMenuCategories = Object.entries(groupedMenu).sort(
    ([categoryA], [categoryB]) => {
      const indexA = priorityCategoryIndex.get(categoryA);
      const indexB = priorityCategoryIndex.get(categoryB);

      if (indexA !== undefined && indexB !== undefined) {
        return indexA - indexB;
      }
      if (indexA !== undefined) return -1;
      if (indexB !== undefined) return 1;
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

                    <div className="discount-section">
                      <label
                        htmlFor="order-discount"
                        className="discount-label"
                      >
                        İndirim (TL)
                      </label>
                      <div className="discount-quick-buttons">
                        <button
                          type="button"
                          onClick={() => handleQuickDiscount(15)}
                          className={`discount-quick-button ${quickDiscountPercent === 15 ? "active" : ""}`}
                        >
                          %15
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickDiscount(25)}
                          className={`discount-quick-button ${quickDiscountPercent === 25 ? "active" : ""}`}
                        >
                          %25
                        </button>
                      </div>
                      <input
                        id="order-discount"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={
                          calculateDiscountAmount() === 0
                            ? ""
                            : String(calculateDiscountAmount())
                        }
                        onChange={(e) => handleDiscountChange(e.target.value)}
                        className="discount-input"
                        placeholder="0"
                      />
                    </div>

                    <div className="order-total">
                      <h3>Toplam: {calculateTotal()} TL</h3>
                      {calculateDiscountAmount() > 0 && (
                        <div className="order-strike-total">
                          <span>Eski fiyat</span>
                          <span className="strikethrough">
                            {calculateSubtotal()} TL
                          </span>
                        </div>
                      )}
                      {calculateDiscountAmount() > 0 && (
                        <div className="order-discount-total">
                          <span>
                            İndirim
                            {quickDiscountPercent
                              ? ` (%${quickDiscountPercent})`
                              : ""}
                          </span>
                          <span>-{calculateDiscountAmount()} TL</span>
                        </div>
                      )}
                    </div>

                    {orderNote.trim() && (
                      <div className="current-order-note">
                        <strong>Not:</strong> {orderNote}
                      </div>
                    )}

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
                      disabled={isPlacingOrder || currentOrder.length === 0}
                    >
                      {isPlacingOrder ? "İşleniyor..." : "Siparişi Tamamla"}
                    </button>
                  </>
                )}
              </div>
            </section>

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
          {!isHistoryLoaded && historyLoading ? (
            <p className="empty-state">Siparişler yükleniyor...</p>
          ) : orders.length === 0 ? (
            <p className="empty-state">Henüz sipariş bulunmamaktadır.</p>
          ) : (
            <div>
              <div className="history-list">
                {orders.map((order) => {
                  return (
                    <div
                      key={order.id}
                      className={`history-item ${order.discountAmount ? "has-discount" : ""}`}
                    >
                      <div className="history-header">
                        <div className="history-date">
                          <strong>Tarih:</strong> {order.date}
                        </div>

                        <div className="history-header-right">
                          {order.discountAmount ? (
                            <div
                              className="history-discount-badge"
                              title="İndirimli sipariş"
                            >
                              %
                            </div>
                          ) : null}

                          <div className="history-payment">
                            <strong>Ödeme:</strong>{" "}
                            {order.paymentMethod === "cash" ? "Nakit" : "Kart"}
                          </div>

                          {order.source === "table" && (
                            <div className="history-source">
                              <strong>Kaynak:</strong> Masa{" "}
                              {order.tableId ?? "-"}
                            </div>
                          )}
                        </div>
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
                              {(item.complimentary ||
                                item.modifiers?.length) && (
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
                            <div
                              style={{ fontSize: "0.9rem", color: "#b56938" }}
                            >
                              İndirim: -{order.discountAmount} TL
                            </div>
                          ) : null}
                          {typeof order.dailyRevenueAfter === "number" &&
                          typeof order.dailyRevenueBefore === "number" ? (
                            <div className="history-daily-running-total">
                              Günlük Ciro: {order.dailyRevenueBefore} TL +
                              {typeof order.dailyRevenueDelta === "number"
                                ? ` ${order.dailyRevenueDelta}`
                                : ` ${order.total}`}{" "}
                              TL = {order.dailyRevenueAfter} TL
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

              <div className="history-pagination">
                {hasMore ? (
                  <button
                    onClick={() => void loadMoreOrders()}
                    className="history-load-more"
                    disabled={historyLoading}
                  >
                    {historyLoading ? "Yükleniyor..." : "Daha Fazla Yükle"}
                  </button>
                ) : (
                  <p className="history-end">Tüm siparişler yüklendi.</p>
                )}
              </div>
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
