import { initializeApp, type FirebaseOptions, type FirebaseApp, getApps } from "@firebase/app";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
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
    createdAt?: Timestamp;
}

/**
 * Add a new order to Firestore
 */
export async function addOrder(order: Omit<FirestoreOrder, "id">) {
    try {
        const ordersCollection = getOrdersCollection();
        const docRef = await addDoc(ordersCollection, {
            ...order,
            createdAt: Timestamp.now(),
        });
        return { id: docRef.id, ...order };
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
 * Delete an order from Firestore
 */
export async function deleteOrder(orderId: string) {
    try {
        const database = getDb();
        await deleteDoc(doc(database, "orders", orderId));
    } catch (error) {
        console.error("Error deleting order:", error);
        throw error;
    }
}

/**
 * Fetch orders for a specific date range (useful for analytics)
 */
export async function fetchOrdersByDateRange(
    startDate: string,
    endDate: string
): Promise<FirestoreOrder[]> {
    try {
        const ordersCollection = getOrdersCollection();
        const q = query(ordersCollection, orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const orders: FirestoreOrder[] = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data() as Omit<FirestoreOrder, "id">;
            if (data.date >= startDate && data.date <= endDate) {
                orders.push({
                    id: docSnap.id,
                    ...data,
                });
            }
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
