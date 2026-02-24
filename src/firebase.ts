import { initializeApp, type FirebaseOptions, type FirebaseApp, getApps } from "@firebase/app";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    where,
    Timestamp,
    type Firestore,
} from "@firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app: FirebaseApp;
let db: Firestore;

// Initialize Firebase and Firestore
const initializeFirebase = () => {
    try {
        // Check if Firebase app already exists to avoid double initialization
        const existingApps = getApps();
        if (existingApps.length > 0) {
            app = existingApps[0];
        } else {
            app = initializeApp(firebaseConfig);
        }

        // Initialize Firestore
        db = getFirestore(app);
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        throw error;
    }
};

// Initialize immediately on module load
initializeFirebase();

// Export db getter
export const getDb = (): Firestore => {
    return db;
};

// Collection reference getter
const getOrdersCollection = () => {
    const database = getDb();
    return collection(database, "orders");
};

// Collection reference for monthly aggregates
const getMonthlyAggregatesCollection = () => {
    const database = getDb();
    return collection(database, "monthlyAggregates");
};

// Firestore Order interface (matches your Order interface)
export interface FirestoreOrder {
    id?: string;
    items: Array<{
        product: string;
        price: number;
        quantity: number;
    }>;
    total: number;
    paymentMethod: "cash" | "card";
    date: string;
    note?: string;
    createdAt?: Timestamp;
}

// Daily aggregate interface for efficient analytics
export interface DailyAggregate {
    date: string; // YYYY-MM-DD format
    totalRevenue: number;
    totalOrders: number;
    cashRevenue: number;
    cashOrders: number;
    cardRevenue: number;
    cardOrders: number;
    itemCounts: Record<string, number>; // product name -> quantity sold
    lastUpdated: Timestamp;
}

// Monthly aggregate document interface
export interface MonthlyAggregate {
    id?: string; // Format: YYYY-MM
    month: string; // Format: YYYY-MM
    dailyStats: Record<string, DailyAggregate>; // date -> daily aggregate
    lastUpdated: Timestamp;
}

/**
 * Add a new order to Firestore and update daily aggregates
 */
export async function addOrder(order: Omit<FirestoreOrder, "id">) {
    try {
        const ordersCollection = getOrdersCollection();
        const docRef = await addDoc(ordersCollection, {
            ...order,
            createdAt: Timestamp.now(),
        });

        const newOrder = { id: docRef.id, ...order };

        // Update daily aggregate
        await updateDailyAggregate(newOrder);

        return newOrder;
    } catch (error) {
        console.error("Error adding order:", error);
        throw error;
    }
}

/**
 * Fetch all orders from Firestore
 */
export async function fetchOrders(): Promise<FirestoreOrder[]> {
    try {
        const ordersCollection = getOrdersCollection();
        const q = query(ordersCollection, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const orders: FirestoreOrder[] = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data() as Omit<FirestoreOrder, "id">;
            orders.push({
                id: docSnap.id,
                ...data,
            });
        });

        return orders;
    } catch (error) {
        console.error("Error fetching orders:", error);
        throw error;
    }
}

/**
 * Delete an order from Firestore and update daily aggregates
 */
export async function deleteOrder(orderId: string) {
    try {
        const database = getDb();
        const orderDocRef = doc(database, "orders", orderId);

        // Fetch the order first so we can update aggregates
        const orderDoc = await getDoc(orderDocRef);
        if (!orderDoc.exists()) {
            throw new Error("Order not found");
        }

        const orderData = orderDoc.data() as Omit<FirestoreOrder, "id">;
        const order: FirestoreOrder = {
            id: orderId,
            ...orderData,
        };

        // Delete the order
        await deleteDoc(orderDocRef);

        // Update daily aggregate (decrement values)
        await decrementDailyAggregate(order);

        console.log(`✅ Deleted order ${orderId} and updated aggregates`);
    } catch (error) {
        console.error("Error deleting order:", error);
        throw error;
    }
}

/**
 * Fetch orders for a specific date range (useful for analytics)
 * Uses Firestore where clauses for efficient querying
 */
export async function fetchOrdersByDateRange(
    startDate: string,
    endDate: string
): Promise<FirestoreOrder[]> {
    try {
        const ordersCollection = getOrdersCollection();
        const q = query(
            ordersCollection,
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc")
        );
        const querySnapshot = await getDocs(q);
        const orders: FirestoreOrder[] = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data() as Omit<FirestoreOrder, "id">;
            orders.push({
                id: docSnap.id,
                ...data,
            });
        });

        return orders;
    } catch (error) {
        console.error("Error fetching orders by date range:", error);
        throw error;
    }
}

/**
 * Fetch total revenue for a specific date
 */
export async function fetchDailyRevenue(date: string): Promise<number> {
    try {
        const ordersCollection = getOrdersCollection();
        const q = query(ordersCollection, orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        let total = 0;

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data() as Omit<FirestoreOrder, "id">;
            if (data.date === date) {
                total += data.total;
            }
        });

        return total;
    } catch (error) {
        console.error("Error fetching daily revenue:", error);
        throw error;
    }
}

/**
 * Update daily aggregate when a new order is placed
 * This function is called automatically when an order is added
 */
export async function updateDailyAggregate(order: FirestoreOrder): Promise<void> {
    try {
        // Extract just the date portion (YYYY-MM-DD) in case the order.date has time component
        const orderDate = order.date.split(' ')[0]; // YYYY-MM-DD
        const monthKey = orderDate.substring(0, 7); // YYYY-MM
        const monthlyAggregatesCollection = getMonthlyAggregatesCollection();
        const monthDocRef = doc(monthlyAggregatesCollection, monthKey);

        // Fetch existing monthly document
        const monthDoc = await getDoc(monthDocRef);

        let monthlyData: Omit<MonthlyAggregate, "id">;

        if (monthDoc.exists()) {
            monthlyData = monthDoc.data() as Omit<MonthlyAggregate, "id">;
        } else {
            // Create new monthly document
            monthlyData = {
                month: monthKey,
                dailyStats: {},
                lastUpdated: Timestamp.now(),
            };
        }

        // Get or create daily stats
        const dailyStats = monthlyData.dailyStats[orderDate] || {
            date: orderDate,
            totalRevenue: 0,
            totalOrders: 0,
            cashRevenue: 0,
            cashOrders: 0,
            cardRevenue: 0,
            cardOrders: 0,
            itemCounts: {},
            lastUpdated: Timestamp.now(),
        };

        // Update daily stats
        dailyStats.totalRevenue += order.total;
        dailyStats.totalOrders += 1;

        if (order.paymentMethod === "cash") {
            dailyStats.cashRevenue += order.total;
            dailyStats.cashOrders += 1;
        } else {
            dailyStats.cardRevenue += order.total;
            dailyStats.cardOrders += 1;
        }

        // Update item counts
        order.items.forEach((item) => {
            dailyStats.itemCounts[item.product] =
                (dailyStats.itemCounts[item.product] || 0) + item.quantity;
        });

        dailyStats.lastUpdated = Timestamp.now();

        // Update the monthly document
        monthlyData.dailyStats[orderDate] = dailyStats;
        monthlyData.lastUpdated = Timestamp.now();

        await setDoc(monthDocRef, monthlyData);
        console.log(`✅ Updated daily aggregate for ${orderDate}`);
    } catch (error) {
        console.error("Error updating daily aggregate:", error);
        throw error;
    }
}

/**
 * Decrement daily aggregate when an order is deleted
 * This function is called automatically when an order is deleted
 */
export async function decrementDailyAggregate(order: FirestoreOrder): Promise<void> {
    try {
        // Extract just the date portion (YYYY-MM-DD) in case the order.date has time component
        const orderDate = order.date.split(' ')[0]; // YYYY-MM-DD
        const monthKey = orderDate.substring(0, 7); // YYYY-MM
        const monthlyAggregatesCollection = getMonthlyAggregatesCollection();
        const monthDocRef = doc(monthlyAggregatesCollection, monthKey);

        // Fetch existing monthly document
        const monthDoc = await getDoc(monthDocRef);

        if (!monthDoc.exists()) {
            console.warn(`⚠️ Monthly aggregate for ${monthKey} not found, skipping decrement`);
            return;
        }

        const monthlyData = monthDoc.data() as Omit<MonthlyAggregate, "id">;

        // Get daily stats
        const dailyStats = monthlyData.dailyStats[orderDate];

        if (!dailyStats) {
            console.warn(`⚠️ Daily stats for ${orderDate} not found, skipping decrement`);
            return;
        }

        // Decrement daily stats
        dailyStats.totalRevenue -= order.total;
        dailyStats.totalOrders -= 1;

        if (order.paymentMethod === "cash") {
            dailyStats.cashRevenue -= order.total;
            dailyStats.cashOrders -= 1;
        } else {
            dailyStats.cardRevenue -= order.total;
            dailyStats.cardOrders -= 1;
        }

        // Decrement item counts
        order.items.forEach((item) => {
            const currentCount = dailyStats.itemCounts[item.product] || 0;
            const newCount = currentCount - item.quantity;
            if (newCount <= 0) {
                delete dailyStats.itemCounts[item.product];
            } else {
                dailyStats.itemCounts[item.product] = newCount;
            }
        });

        dailyStats.lastUpdated = Timestamp.now();

        // If no orders left for this day, remove the daily stats
        if (dailyStats.totalOrders <= 0) {
            delete monthlyData.dailyStats[orderDate];
        } else {
            monthlyData.dailyStats[orderDate] = dailyStats;
        }

        monthlyData.lastUpdated = Timestamp.now();

        // If no daily stats left in the month, delete the document
        if (Object.keys(monthlyData.dailyStats).length === 0) {
            await deleteDoc(monthDocRef);
            console.log(`✅ Deleted empty monthly aggregate for ${monthKey}`);
        } else {
            await setDoc(monthDocRef, monthlyData);
            console.log(`✅ Decremented daily aggregate for ${orderDate}`);
        }
    } catch (error) {
        console.error("Error decrementing daily aggregate:", error);
        throw error;
    }
}

/**
 * Fetch monthly aggregate data
 */
export async function fetchMonthlyAggregate(monthKey: string): Promise<MonthlyAggregate | null> {
    try {
        const monthlyAggregatesCollection = getMonthlyAggregatesCollection();
        const monthDocRef = doc(monthlyAggregatesCollection, monthKey);
        const monthDoc = await getDoc(monthDocRef);

        if (monthDoc.exists()) {
            return {
                id: monthDoc.id,
                ...monthDoc.data() as Omit<MonthlyAggregate, "id">,
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching monthly aggregate:", error);
        throw error;
    }
}

/**
 * Fetch aggregates for a date range (multiple months if needed)
 */
export async function fetchAggregatesInRange(
    startDate: string,
    endDate: string
): Promise<DailyAggregate[]> {
    try {
        const aggregates: DailyAggregate[] = [];

        // Get unique months in the range
        const startMonth = startDate.substring(0, 7);
        const endMonth = endDate.substring(0, 7);

        const months: string[] = [];
        let currentMonth = startMonth;
        while (currentMonth <= endMonth) {
            months.push(currentMonth);
            // Increment month
            const [year, month] = currentMonth.split('-').map(Number);
            const nextDate = new Date(year, month, 1); // month is 0-indexed, so this gives us next month
            currentMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        }

        // Fetch all relevant monthly documents
        for (const monthKey of months) {
            const monthData = await fetchMonthlyAggregate(monthKey);

            if (monthData && monthData.dailyStats) {
                // Filter daily stats within the date range
                Object.entries(monthData.dailyStats).forEach(([date, stats]) => {
                    if (date >= startDate && date <= endDate) {
                        aggregates.push(stats);
                    }
                });
            }
        }

        return aggregates.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("Error fetching aggregates in range:", error);
        throw error;
    }
}
