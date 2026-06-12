import { useEffect, useMemo, useState } from "react";
import { addOrder, type FirestoreOrder } from "./firebase";
import { menuItems, type MenuItem } from "./menu";
import "./TableManagement.css";

type TableStatus = "available" | "occupied" | "paid";
type MilkOption = "regular" | "oat" | "almond" | "coconut" | "lactose-free";

interface TableOrderItem {
  product: string;
  price: number;
  quantity: number;
  basePrice: number;
  modifiers: string[];
  complimentary: boolean;
}

interface TableState {
  id: number;
  status: TableStatus;
  items: TableOrderItem[];
  note: string;
  loyaltyDiscount: boolean;
  paymentMethod: "cash" | "card";
  lastSavedAt?: string;
}

interface TableDraft {
  milkOption: MilkOption;
  extraShot: boolean;
  decaf: boolean;
  complimentary: boolean;
}

const TABLE_COUNT = 12;
const STORAGE_KEY = "gato-table-management-beta-v2";
const EXTRA_SHOT_PRICE = 55;
const LOYALTY_DISCOUNT_RATE = 0.1;

const MILK_OPTIONS: Array<{ value: MilkOption; label: string; price: number }> =
  [
    { value: "regular", label: "Regular Milk", price: 0 },
    { value: "oat", label: "Oat Milk", price: 85 },
    { value: "almond", label: "Almond Milk", price: 85 },
    { value: "coconut", label: "Coconut Milk", price: 85 },
    { value: "lactose-free", label: "Lactose-Free Milk", price: 0 },
  ];

const DEFAULT_DRAFT: TableDraft = {
  milkOption: "regular",
  extraShot: false,
  decaf: false,
  complimentary: false,
};

function formatDateTimeForIstanbul() {
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

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function createInitialTables(): TableState[] {
  return Array.from({ length: TABLE_COUNT }, (_, index) => ({
    id: index + 1,
    status: "available" as TableStatus,
    items: [],
    note: "",
    loyaltyDiscount: false,
    paymentMethod: "cash",
  }));
}

function createInitialDrafts(): Record<number, TableDraft> {
  return Array.from({ length: TABLE_COUNT }, (_, index) => index + 1).reduce(
    (acc, tableId) => {
      acc[tableId] = { ...DEFAULT_DRAFT };
      return acc;
    },
    {} as Record<number, TableDraft>,
  );
}

function readStoredTables(): TableState[] {
  try {
    const rawTables = localStorage.getItem(STORAGE_KEY);
    if (!rawTables) {
      return createInitialTables();
    }

    const parsedTables = JSON.parse(rawTables) as TableState[];
    if (!Array.isArray(parsedTables) || parsedTables.length !== TABLE_COUNT) {
      return createInitialTables();
    }

    return parsedTables.map((table, index) => ({
      id: index + 1,
      status:
        table.status === "occupied" || table.status === "paid"
          ? table.status
          : "available",
      items: Array.isArray(table.items)
        ? table.items.map((item) => ({
            product: item.product,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            basePrice: Number(item.basePrice) || Number(item.price) || 0,
            modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
            complimentary: Boolean(item.complimentary),
          }))
        : [],
      note: typeof table.note === "string" ? table.note : "",
      loyaltyDiscount: Boolean(table.loyaltyDiscount),
      paymentMethod: table.paymentMethod === "card" ? "card" : "cash",
      lastSavedAt:
        typeof table.lastSavedAt === "string" ? table.lastSavedAt : undefined,
    }));
  } catch (error) {
    console.error("Failed to load table management state:", error);
    return createInitialTables();
  }
}

function formatTableSubtotal(items: TableOrderItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function formatTableDiscount(table: TableState) {
  return table.loyaltyDiscount
    ? formatTableSubtotal(table.items) * LOYALTY_DISCOUNT_RATE
    : 0;
}

function formatTableFinalTotal(table: TableState) {
  return Math.max(
    0,
    formatTableSubtotal(table.items) - formatTableDiscount(table),
  );
}

function buildModifierSummary(draft: TableDraft) {
  const modifiers: string[] = [];
  let modifierAmount = 0;

  const milkOption = MILK_OPTIONS.find(
    (option) => option.value === draft.milkOption,
  )!;
  modifiers.push(`Milk: ${milkOption.label}`);
  modifierAmount += milkOption.price;

  if (draft.extraShot) {
    modifiers.push(`Extra Espresso Shot (+${EXTRA_SHOT_PRICE} TL)`);
    modifierAmount += EXTRA_SHOT_PRICE;
  }

  if (draft.decaf) {
    modifiers.push("Decaf Option");
  }

  if (draft.complimentary) {
    modifiers.push("Complimentary");
  }

  return { modifiers, modifierAmount };
}

function buildOrderForTable(table: TableState): Omit<FirestoreOrder, "id"> {
  const subtotal = formatTableSubtotal(table.items);
  const discountAmount = formatTableDiscount(table);

  return {
    items: table.items.map((item) => ({
      product: item.product,
      price: item.price,
      quantity: item.quantity,
      basePrice: item.basePrice,
      modifiers: item.modifiers,
      complimentary: item.complimentary,
    })),
    total: Math.max(0, subtotal - discountAmount),
    paymentMethod: table.paymentMethod,
    date: formatDateTimeForIstanbul(),
    ...(table.note.trim() && { note: table.note.trim() }),
    source: "table",
    tableId: table.id,
    tableName: `Table ${table.id}`,
    loyaltyDiscount: table.loyaltyDiscount,
    ...(discountAmount > 0 && { discountAmount }),
  };
}

export function TableManagement() {
  const [tables, setTables] = useState<TableState[]>(() => readStoredTables());
  const [selectedProducts, setSelectedProducts] = useState<
    Record<number, string>
  >({});
  const [drafts, setDrafts] = useState<Record<number, TableDraft>>(() =>
    createInitialDrafts(),
  );
  const [savingTableId, setSavingTableId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const groupedMenu = useMemo(() => {
    return menuItems.reduce(
      (acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
      },
      {} as Record<string, MenuItem[]>,
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  }, [tables]);

  const updateTable = (
    tableId: number,
    updater: (table: TableState) => TableState,
  ) => {
    setTables((currentTables) =>
      currentTables.map((table) =>
        table.id === tableId ? updater(table) : table,
      ),
    );
  };

  const updateDraft = (
    tableId: number,
    updater: (draft: TableDraft) => TableDraft,
  ) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [tableId]: updater(currentDrafts[tableId] || { ...DEFAULT_DRAFT }),
    }));
  };

  const resetTableSession = (tableId: number) => {
    setSelectedProducts((current) => ({
      ...current,
      [tableId]: "",
    }));
    updateDraft(tableId, () => ({ ...DEFAULT_DRAFT }));
  };

  const openTable = (tableId: number) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const hasPreviousContent =
      table.status === "paid" &&
      (table.items.length > 0 || table.note.trim().length > 0);

    const shouldReset =
      !hasPreviousContent ||
      window.confirm(
        `Table ${tableId} has a saved order. Start fresh and clear it?`,
      );

    updateTable(tableId, (t) => ({
      ...t,
      status: "occupied",
      ...(shouldReset && {
        items: [],
        note: "",
        loyaltyDiscount: false,
        paymentMethod: "cash",
        lastSavedAt: undefined,
      }),
    }));

    if (shouldReset) {
      resetTableSession(tableId);
    }
  };

  const saveAndCloseTable = async (tableId: number) => {
    const table = tables.find((item) => item.id === tableId);
    if (!table || table.status !== "occupied") {
      return;
    }

    const hasContent =
      table.items.length > 0 ||
      table.note.trim().length > 0 ||
      table.loyaltyDiscount;

    try {
      setSavingTableId(tableId);
      setErrorMessage(null);

      if (hasContent) {
        await addOrder(buildOrderForTable(table));
      }

      const savedAt = formatDateTimeForIstanbul();
      updateTable(tableId, (currentTable) => ({
        ...currentTable,
        status: "paid",
        lastSavedAt: savedAt,
      }));
      resetTableSession(tableId);
    } catch (error) {
      console.error("Failed to save table order:", error);
      setErrorMessage(
        "Table order could not be saved to reporting. The table remains open.",
      );
    } finally {
      setSavingTableId(null);
    }
  };

  const addProductToTable = (tableId: number) => {
    const selectedProduct = selectedProducts[tableId];
    if (!selectedProduct) {
      return;
    }

    const menuItem = menuItems.find((item) => item.product === selectedProduct);
    if (!menuItem) {
      return;
    }

    const draft = drafts[tableId] || { ...DEFAULT_DRAFT };
    const { modifiers, modifierAmount } = buildModifierSummary(draft);
    const price = draft.complimentary ? 0 : menuItem.price + modifierAmount;

    updateTable(tableId, (table) => {
      if (table.status !== "occupied") {
        return table;
      }

      const existingItemIndex = table.items.findIndex((item) => {
        return (
          item.product === selectedProduct &&
          item.complimentary === draft.complimentary &&
          item.modifiers.join("|") === modifiers.join("|")
        );
      });

      if (existingItemIndex >= 0) {
        const updatedItems = [...table.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + 1,
        };

        return {
          ...table,
          items: updatedItems,
        };
      }

      return {
        ...table,
        items: [
          ...table.items,
          {
            product: menuItem.product,
            price,
            quantity: 1,
            basePrice: menuItem.price,
            modifiers,
            complimentary: draft.complimentary,
          },
        ],
      };
    });

    setSelectedProducts((current) => ({
      ...current,
      [tableId]: "",
    }));
  };

  const updateItemQuantity = (
    tableId: number,
    product: string,
    delta: number,
  ) => {
    updateTable(tableId, (table) => {
      if (table.status !== "occupied") {
        return table;
      }

      const updatedItems = table.items
        .map((item) =>
          item.product === product
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0);

      return {
        ...table,
        items: updatedItems,
      };
    });
  };

  const removeItem = (tableId: number, product: string) => {
    updateTable(tableId, (table) => ({
      ...table,
      items: table.items.filter((item) => item.product !== product),
    }));
  };

  const toggleItemComplimentary = (tableId: number, product: string) => {
    updateTable(tableId, (table) => ({
      ...table,
      items: table.items.map((item) =>
        item.product !== product
          ? item
          : {
              ...item,
              complimentary: !item.complimentary,
              price: !item.complimentary ? 0 : item.basePrice,
            },
      ),
    }));
  };

  const updateNote = (tableId: number, note: string) => {
    updateTable(tableId, (table) => ({
      ...table,
      note,
    }));
  };

  const toggleLoyaltyDiscount = (tableId: number) => {
    updateTable(tableId, (table) => ({
      ...table,
      loyaltyDiscount: !table.loyaltyDiscount,
    }));
  };

  const updatePaymentMethod = (
    tableId: number,
    paymentMethod: "cash" | "card",
  ) => {
    updateTable(tableId, (table) => ({
      ...table,
      paymentMethod,
    }));
  };

  const tableCounts = tables.reduce(
    (acc, table) => {
      acc[table.status] += 1;
      return acc;
    },
    { available: 0, occupied: 0, paid: 0 },
  );

  return (
    <div className="table-management-shell">
      <div className="beta-banner">
        Experimental / Beta: table actions stay separate, but closed tables are
        saved into reporting.
      </div>

      {errorMessage && <div className="table-error-banner">{errorMessage}</div>}

      <div className="table-management-summary">
        <div className="summary-card">
          <span>Available</span>
          <strong>{tableCounts.available}</strong>
        </div>
        <div className="summary-card">
          <span>Occupied</span>
          <strong>{tableCounts.occupied}</strong>
        </div>
        <div className="summary-card">
          <span>Paid</span>
          <strong>{tableCounts.paid}</strong>
        </div>
      </div>

      <div className="table-grid">
        {tables.map((table) => {
          const subtotal = formatTableSubtotal(table.items);
          const discount = formatTableDiscount(table);
          const finalTotal = formatTableFinalTotal(table);
          const selectedProduct = selectedProducts[table.id] || "";
          const draft = drafts[table.id] || { ...DEFAULT_DRAFT };

          return (
            <div key={table.id} className={`table-card ${table.status}`}>
              <div className="table-card-header">
                <div>
                  <div className="table-title">Table {table.id}</div>
                  <div className={`table-status status-${table.status}`}>
                    {table.status === "available"
                      ? "Available"
                      : table.status === "occupied"
                        ? "Occupied"
                        : "Paid"}
                  </div>
                </div>

                <div className="table-actions">
                  {table.status === "occupied" ? (
                    <button
                      className="table-action-button close"
                      onClick={() => void saveAndCloseTable(table.id)}
                      disabled={savingTableId === table.id}
                    >
                      {savingTableId === table.id ? "Saving..." : "Close Table"}
                    </button>
                  ) : (
                    <button
                      className="table-action-button open"
                      onClick={() => openTable(table.id)}
                    >
                      {table.status === "paid" ? "Reopen Table" : "Open Table"}
                    </button>
                  )}
                </div>
              </div>

              <div className="table-mini-summary">
                <span>{table.items.length} items</span>
                <strong>{finalTotal.toFixed(0)} TL</strong>
              </div>

              {table.status !== "available" && subtotal > 0 && (
                <div className="table-financials">
                  <div>
                    Subtotal: <strong>{subtotal.toFixed(0)} TL</strong>
                  </div>
                  {table.loyaltyDiscount && discount > 0 && (
                    <div>
                      Loyalty: <strong>-{discount.toFixed(0)} TL</strong>
                    </div>
                  )}
                </div>
              )}

              {table.status === "occupied" && (
                <>
                  <div className="table-product-selector">
                    <select
                      value={selectedProduct}
                      onChange={(event) =>
                        setSelectedProducts((current) => ({
                          ...current,
                          [table.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select product...</option>
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
                    <button
                      className="table-action-button add"
                      onClick={() => addProductToTable(table.id)}
                      disabled={!selectedProduct}
                    >
                      Add
                    </button>
                  </div>

                  <div className="modifier-panel">
                    <div className="modifier-group">
                      <span>Milk Options</span>
                      <div className="modifier-options">
                        {MILK_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            className={`modifier-chip ${draft.milkOption === option.value ? "active" : ""}`}
                            onClick={() =>
                              setDrafts((current) => ({
                                ...current,
                                [table.id]: {
                                  ...draft,
                                  milkOption: option.value,
                                },
                              }))
                            }
                          >
                            {option.label}
                            {option.price > 0 ? ` (+${option.price})` : ""}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="modifier-group">
                      <span>Coffee Options</span>
                      <div className="modifier-options compact">
                        <button
                          className={`modifier-chip ${draft.extraShot ? "active" : ""}`}
                          onClick={() =>
                            setDrafts((current) => ({
                              ...current,
                              [table.id]: {
                                ...draft,
                                extraShot: !draft.extraShot,
                              },
                            }))
                          }
                        >
                          Extra Espresso Shot (+{EXTRA_SHOT_PRICE})
                        </button>
                        <button
                          className={`modifier-chip ${draft.decaf ? "active" : ""}`}
                          onClick={() =>
                            setDrafts((current) => ({
                              ...current,
                              [table.id]: {
                                ...draft,
                                decaf: !draft.decaf,
                              },
                            }))
                          }
                        >
                          Decaf Option
                        </button>
                        <button
                          className={`modifier-chip ${draft.complimentary ? "active" : ""}`}
                          onClick={() =>
                            setDrafts((current) => ({
                              ...current,
                              [table.id]: {
                                ...draft,
                                complimentary: !draft.complimentary,
                              },
                            }))
                          }
                        >
                          Complimentary
                        </button>
                      </div>
                    </div>

                    <label className="loyalty-toggle">
                      <input
                        type="checkbox"
                        checked={table.loyaltyDiscount}
                        onChange={() => toggleLoyaltyDiscount(table.id)}
                      />
                      Apply 10% loyalty discount to this table
                    </label>
                  </div>

                  <div className="table-items-list">
                    {table.items.length === 0 ? (
                      <div className="empty-table-state">
                        No products added yet.
                      </div>
                    ) : (
                      table.items.map((item) => (
                        <div
                          key={`${item.product}-${item.modifiers.join("-")}-${item.complimentary}`}
                          className="table-item-row"
                        >
                          <div className="table-item-name">
                            <strong>
                              {item.quantity}x {item.product}
                            </strong>
                            <span>
                              {item.price} TL each
                              {item.complimentary ? " · Complimentary" : ""}
                            </span>
                            {item.modifiers.length > 0 && (
                              <span className="modifier-inline">
                                {item.modifiers.join(" · ")}
                              </span>
                            )}
                          </div>
                          <div className="table-item-controls">
                            <span className="line-total">
                              {(item.price * item.quantity).toFixed(0)} TL
                            </span>
                            <button
                              className="quantity-button minus"
                              onClick={() =>
                                updateItemQuantity(table.id, item.product, -1)
                              }
                            >
                              -
                            </button>
                            <button
                              className="quantity-button plus"
                              onClick={() =>
                                updateItemQuantity(table.id, item.product, 1)
                              }
                            >
                              +
                            </button>
                            <button
                              className="table-mini-button"
                              onClick={() =>
                                toggleItemComplimentary(table.id, item.product)
                              }
                            >
                              {item.complimentary ? "Unmark" : "Comp"}
                            </button>
                            <button
                              className="remove-link"
                              onClick={() => removeItem(table.id, item.product)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="payment-block">
                    <span>Payment Method</span>
                    <div className="payment-buttons compact">
                      <button
                        className={`payment-button ${table.paymentMethod === "cash" ? "active" : "inactive"}`}
                        onClick={() => updatePaymentMethod(table.id, "cash")}
                      >
                        Cash
                      </button>
                      <button
                        className={`payment-button ${table.paymentMethod === "card" ? "active" : "inactive"}`}
                        onClick={() => updatePaymentMethod(table.id, "card")}
                      >
                        Card
                      </button>
                    </div>
                  </div>

                  <div className="table-note-block">
                    <label htmlFor={`table-note-${table.id}`}>Order note</label>
                    <textarea
                      id={`table-note-${table.id}`}
                      value={table.note}
                      onChange={(event) =>
                        updateNote(table.id, event.target.value)
                      }
                      placeholder="Add a note for this table..."
                      rows={3}
                    />
                  </div>
                </>
              )}

              {table.status !== "occupied" && table.note && (
                <div className="table-note-preview">
                  <strong>Note:</strong> {table.note}
                </div>
              )}

              {table.status !== "available" && table.lastSavedAt && (
                <div className="table-note-preview">
                  <strong>Saved:</strong> {table.lastSavedAt}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
