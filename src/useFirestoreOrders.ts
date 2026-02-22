import { useState, useEffect } from "react";
import {
    fetchOrders,
    addOrder,
    deleteOrder,
} from "./firebase";
import type { FirestoreOrder } from "./firebase";

interface Order {
    id: string;
    items: Array<{
        product: string;
        price: number;
        quantity: number;
    }>;
    total: number;
    paymentMethod: "cash" | "card";
    date: string;
    note?: string;
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
        const initializeOrders = async () => {
            try {
                setLoading(true);
                setError(null);

                if (isFirestoreEnabled) {
                    try {
                        // Fetch from Firestore
                        const firestoreOrders = await fetchOrders();
                        const convertedOrders: Order[] = firestoreOrders.map((order) => ({
                            id: order.id || "",
                            items: order.items,
                            total: order.total,
                            paymentMethod: order.paymentMethod,
                            date: order.date,
                            ...(order.note && { note: order.note }),
                        }));
                        setOrders(convertedOrders);
                        console.log("✅ Loaded orders from Firestore");
                    } catch (firestoreError) {
                        console.error("❌ Error loading from Firestore:", firestoreError);
                        setError("⚠️ Failed to load orders from Firestore. Firestore may not be properly configured in your Firebase project. Please check the browser console.");
                        setOrders([]); // Clear orders on error
                    }
                } else {
                    console.error("❌ Firestore is not configured");
                    setError("⚠️ Firestore is not configured. Missing VITE_FIREBASE_PROJECT_ID or VITE_FIREBASE_API_KEY environment variables.");
                }
            } catch (err) {
                console.error("Error initializing orders:", err);
                setError("Failed to initialize orders");
            } finally {
                setLoading(false);
            }
        };

        initializeOrders();
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
            };
            const addedOrder = await addOrder(firestoreOrder);
            const convertedOrder: Order = {
                id: addedOrder.id || "",
                items: addedOrder.items,
                total: addedOrder.total,
                paymentMethod: addedOrder.paymentMethod,
                date: addedOrder.date,
                ...(addedOrder.note && { note: addedOrder.note }),
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
