import { useCallback, useState } from "react";
import {
    addOrder,
    deleteOrder,
    getDb,
} from "./firebase";
import type { FirestoreOrder } from "./firebase";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    type DocumentData,
    type QueryDocumentSnapshot,
} from "@firebase/firestore";

const PAGE_SIZE = 25;

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
    dailyRevenueBefore?: number;
    dailyRevenueAfter?: number;
    dailyRevenueDelta?: number;
}

interface UseFirestoreResult {
    orders: Order[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    isHistoryLoaded: boolean;
    loadInitialOrders: () => Promise<void>;
    loadMoreOrders: () => Promise<void>;
    addNewOrder: (order: Omit<Order, "id">) => Promise<void>;
    removeOrder: (orderId: string) => Promise<void>;
    isFirestoreEnabled: boolean;
}

const mapFirestoreOrder = (
    docId: string,
    order: Omit<FirestoreOrder, "id">
): Order => {
    return {
        id: docId,
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
        ...(order.dailyRevenueBefore !== undefined && { dailyRevenueBefore: order.dailyRevenueBefore }),
        ...(order.dailyRevenueAfter !== undefined && { dailyRevenueAfter: order.dailyRevenueAfter }),
        ...(order.dailyRevenueDelta !== undefined && { dailyRevenueDelta: order.dailyRevenueDelta }),
    };
};

/**
 * Custom hook to manage orders with Firestore
 * Falls back to localStorage if Firestore is not configured
 */
export function useFirestoreOrders(
): UseFirestoreResult {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const isFirestoreEnabled =
        !!import.meta.env.VITE_FIREBASE_PROJECT_ID &&
        !!import.meta.env.VITE_FIREBASE_API_KEY;

    const loadInitialOrders = useCallback(async () => {
        try {
            setError(null);

            if (!isFirestoreEnabled) {
                throw new Error("Firestore is not configured");
            }

            setLoading(true);
            const database = getDb();
            const ordersCollection = collection(database, "orders");
            const ordersQuery = query(
                ordersCollection,
                orderBy("createdAt", "desc"),
                limit(PAGE_SIZE)
            );

            const snapshot = await getDocs(ordersQuery);
            const convertedOrders: Order[] = snapshot.docs.map((docSnap) => {
                const order = docSnap.data() as Omit<FirestoreOrder, "id">;
                return mapFirestoreOrder(docSnap.id, order);
            });

            setOrders(convertedOrders);
            setLastDoc(snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null);
            setHasMore(snapshot.docs.length === PAGE_SIZE);
            setIsHistoryLoaded(true);
            console.log(`✅ Loaded initial ${convertedOrders.length} orders from Firestore`);
        } catch (err) {
            console.error("❌ Error loading initial orders from Firestore:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`⚠️ Failed to load orders from Firestore: ${errorMessage}`);
            setOrders([]);
            setHasMore(false);
            setIsHistoryLoaded(true);
        } finally {
            setLoading(false);
        }
    }, [isFirestoreEnabled]);

    const loadMoreOrders = useCallback(async () => {
        try {
            if (loading || !hasMore || !lastDoc) {
                return;
            }

            setError(null);

            if (!isFirestoreEnabled) {
                throw new Error("Firestore is not configured");
            }

            setLoading(true);
            const database = getDb();
            const ordersCollection = collection(database, "orders");
            const ordersQuery = query(
                ordersCollection,
                orderBy("createdAt", "desc"),
                startAfter(lastDoc),
                limit(PAGE_SIZE)
            );

            const snapshot = await getDocs(ordersQuery);
            const convertedOrders: Order[] = snapshot.docs.map((docSnap) => {
                const order = docSnap.data() as Omit<FirestoreOrder, "id">;
                return mapFirestoreOrder(docSnap.id, order);
            });

            setOrders((previousOrders) => [...previousOrders, ...convertedOrders]);
            setLastDoc(snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : lastDoc);
            setHasMore(snapshot.docs.length === PAGE_SIZE);
            console.log(`✅ Loaded ${convertedOrders.length} more orders from Firestore`);
        } catch (err) {
            console.error("❌ Error loading more orders from Firestore:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`⚠️ Failed to load more orders: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    }, [hasMore, isFirestoreEnabled, lastDoc, loading]);

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
                ...mapFirestoreOrder(addedOrder.id || "", addedOrder),
            };
            setOrders((previousOrders) => [convertedOrder, ...previousOrders]);
            console.log("✅ Order saved to Firestore");
        } catch (err) {
            console.error("Error adding order:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`Failed to save order to Firestore: ${errorMessage}`);
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
            setOrders((previousOrders) => previousOrders.filter((order) => order.id !== orderId));
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
        hasMore,
        isHistoryLoaded,
        loadInitialOrders,
        loadMoreOrders,
        addNewOrder,
        removeOrder,
        isFirestoreEnabled,
    };
}
