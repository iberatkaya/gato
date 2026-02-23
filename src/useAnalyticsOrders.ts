import { useState, useCallback } from "react";
import { fetchAggregatesInRange } from "./firebase";
import type { DailyAggregate } from "./firebase";

interface UseAnalyticsAggregatesResult {
    dailyAggregates: DailyAggregate[];
    loading: boolean;
    error: string | null;
    fetchAggregatesForRange: (startDate: string, endDate: string) => Promise<void>;
    isFirestoreEnabled: boolean;
}

/**
 * Custom hook for analytics page with date range filtering
 * Uses efficient daily aggregates instead of fetching all orders
 */
export function useAnalyticsAggregates(): UseAnalyticsAggregatesResult {
    const [dailyAggregates, setDailyAggregates] = useState<DailyAggregate[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isFirestoreEnabled =
        !!import.meta.env.VITE_FIREBASE_PROJECT_ID &&
        !!import.meta.env.VITE_FIREBASE_API_KEY;

    const fetchAggregatesForRange = useCallback(async (startDate: string, endDate: string) => {
        if (!isFirestoreEnabled) {
            setError("⚠️ Firestore is not configured");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            console.log(`🔍 Fetching aggregates from ${startDate} to ${endDate}`);
            const aggregates = await fetchAggregatesInRange(startDate, endDate);

            // DEBUG: Log detailed information about fetched data
            console.log(`✅ Loaded ${aggregates.length} daily aggregates from ${startDate} to ${endDate}`);
            console.log("🐛 First 3 aggregates:", aggregates.slice(0, 3));

            if (aggregates.length > 0) {
                const sampleStats = {
                    totalAggregates: aggregates.length,
                    firstDate: aggregates[0]?.date,
                    lastDate: aggregates[aggregates.length - 1]?.date,
                    totalRevenue: aggregates.reduce((sum, d) => sum + d.totalRevenue, 0),
                    totalOrders: aggregates.reduce((sum, d) => sum + d.totalOrders, 0),
                };
                console.log("🐛 Aggregate Stats:", sampleStats);
            }

            setDailyAggregates(aggregates);
        } catch (firestoreError) {
            console.error("❌ Error loading aggregates from Firestore:", firestoreError);
            setError("⚠️ Failed to load analytics data from Firestore");
            setDailyAggregates([]);
        } finally {
            setLoading(false);
        }
    }, [isFirestoreEnabled]);

    return {
        dailyAggregates,
        loading,
        error,
        fetchAggregatesForRange,
        isFirestoreEnabled,
    };
}
