import { useState, useEffect } from "react";
import {
    addOrder,
    deleteOrder,
    getDb,
} from "./firebase";
import type { FirestoreOrder } from "./firebase";
import { collection, onSnapshot, orderBy, query } from "@firebase/firestore";

interface Order {
    id: string;
    items: Array<{
        product: string;
        price: number;
        quantity: number;
        basePrice?: number;
        modifiers?: string[];
        complimentary?: boolean;
    }>;
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

interface UseFirestoreResult {
    orders: Order[];
    loading: boolean;
    error: string | null;
    addNewOrder: (order: Omit<Order, "id">) => Promise<void>;
    removeOrder: (orderId: string) => Promise<void>;
    isFirestoreEnabled: boolean;
}

/**
 * Custom hook to manage orders with Firestore
 * Falls back to localStorage if Firestore is not configured
 */
export function useFirestoreOrders(
    localStorageKey: string = "orders"
): UseFirestoreResult {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isFirestoreEnabled =
        !!import.meta.env.VITE_FIREBASE_PROJECT_ID &&
        !!import.meta.env.VITE_FIREBASE_API_KEY;

    // Initialize orders on mount
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const initializeOrders = async () => {
            try {
                setLoading(true);
                setError(null);

                if (isFirestoreEnabled) {
                    const database = getDb();
                    const ordersCollection = collection(database, "orders");
                    const ordersQuery = query(ordersCollection, orderBy("createdAt", "desc"));

                    unsubscribe = onSnapshot(
                        ordersQuery,
                        (snapshot) => {
                            const convertedOrders: Order[] = snapshot.docs.map((docSnap) => {
                                const order = docSnap.data() as Omit<FirestoreOrder, "id">;
                                return {
                                    id: docSnap.id,
                                    items: order.items,
                                    total: order.total,
                                    paymentMethod: order.paymentMethod,
                                    date: order.date,
                                    ...(order.note && { note: order.note }),
                                    ...(order.source && { source: order.source }),
                                    ...(order.tableId !== undefined && { tableId: order.tableId }),
                                    ...(order.tableName && { tableName: order.tableName }),
                                    ...(order.loyaltyDiscount !== undefined && { loyaltyDiscount: order.loyaltyDiscount }),
                                    ...(order.discountAmount !== undefined && { discountAmount: order.discountAmount }),
                                };
                            });

                            setOrders(convertedOrders);
                            setLoading(false);
                            console.log(`✅ Loaded ${convertedOrders.length} orders from Firestore`);
                        },
                        (firestoreError) => {
                            console.error("❌ Error loading from Firestore:", firestoreError);
                            setError("⚠️ Failed to load orders from Firestore. Firestore may not be properly configured in your Firebase project. Please check the browser console.");
                            setOrders([]);
                            setLoading(false);
                        },
                    );
                } else {
                    console.error("❌ Firestore is not configured");
                    setError("⚠️ Firestore is not configured. Missing VITE_FIREBASE_PROJECT_ID or VITE_FIREBASE_API_KEY environment variables.");
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error initializing orders:", err);
                setError("Failed to initialize orders");
                setLoading(false);
            }
        };

        void initializeOrders();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [isFirestoreEnabled, localStorageKey]);

    const addNewOrder = async (newOrder: Omit<Order, "id">) => {
        try {
            setError(null);

            if (!isFirestoreEnabled) {
                throw new Error("Firestore is not configured");
            }

            // Add to Firestore
            const firestoreOrder: Omit<FirestoreOrder, "id"> = {
                items: newOrder.items,
                total: newOrder.total,
                paymentMethod: newOrder.paymentMethod,
                date: newOrder.date,
                ...(newOrder.note && { note: newOrder.note }),
                ...(newOrder.source && { source: newOrder.source }),
                ...(newOrder.tableId !== undefined && { tableId: newOrder.tableId }),
                ...(newOrder.tableName && { tableName: newOrder.tableName }),
                ...(newOrder.loyaltyDiscount !== undefined && { loyaltyDiscount: newOrder.loyaltyDiscount }),
                ...(newOrder.discountAmount !== undefined && { discountAmount: newOrder.discountAmount }),
            };
            const addedOrder = await addOrder(firestoreOrder);
            const convertedOrder: Order = {
                id: addedOrder.id || "",
                items: addedOrder.items,
                total: addedOrder.total,
                paymentMethod: addedOrder.paymentMethod,
                date: addedOrder.date,
                ...(addedOrder.note && { note: addedOrder.note }),
                ...(addedOrder.source && { source: addedOrder.source }),
                ...(addedOrder.tableId !== undefined && { tableId: addedOrder.tableId }),
                ...(addedOrder.tableName && { tableName: addedOrder.tableName }),
                ...(addedOrder.loyaltyDiscount !== undefined && { loyaltyDiscount: addedOrder.loyaltyDiscount }),
                ...(addedOrder.discountAmount !== undefined && { discountAmount: addedOrder.discountAmount }),
            };
            setOrders([convertedOrder, ...orders]);
            console.log("✅ Order saved to Firestore");
        } catch (err) {
            console.error("Error adding order:", err);
            setError("Failed to save order to Firestore");
            throw err;
        }
    };

    const removeOrder = async (orderId: string) => {
        try {
            setError(null);

            if (!isFirestoreEnabled) {
                throw new Error("Firestore is not configured");
            }

            // Delete from Firestore
            await deleteOrder(orderId);
            console.log("✅ Order deleted from Firestore");

            // Remove from local state
            const updatedOrders = orders.filter((order) => order.id !== orderId);
            setOrders(updatedOrders);
        } catch (err) {
            console.error("Error deleting order:", err);
            setError("Failed to delete order from Firestore");
            throw err;
        }
    };

    return {
        orders,
        loading,
        error,
        addNewOrder,
        removeOrder,
        isFirestoreEnabled,
    };
}
