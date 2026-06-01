// src/hook/useApi.js
import { useState, useEffect, useCallback, useRef } from 'react';
import apiService from '../services/apiService';

// Cache to prevent duplicate requests
const requestCache = new Map();
const pendingRequests = new Map();

export const useApi = (apiFunction, immediate = true, initialData = null) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const isMounted = useRef(true);
  const isExecuting = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const execute = useCallback(async (...args) => {
    if (!isMounted.current || isExecuting.current) return null;

    // Create cache key
    const cacheKey = `${apiFunction.name}_${JSON.stringify(args)}`;
    
    // Check if request is already pending
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    // Check cache (5 second TTL)
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5000) {
      setData(cached.data);
      return cached.data;
    }

    isExecuting.current = true;

    try {
      setLoading(true);
      setError(null);
      
      // Create promise for this request
      const requestPromise = apiFunction(...args);
      pendingRequests.set(cacheKey, requestPromise);
      
      const result = await requestPromise;
      
      if (isMounted.current) {
        const resultData = result.data || result;
        setData(resultData);
        
        // Cache the result
        requestCache.set(cacheKey, {
          data: resultData,
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (err) {
      if (isMounted.current) {
        const errorMessage = apiService.handleApiError(err);
        setError(errorMessage);
      }
      throw err;
    } finally {
      pendingRequests.delete(cacheKey);
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
        isExecuting.current = false;
      }
    }
  }, [apiFunction]);

  const refresh = useCallback(async (...args) => {
    if (!isMounted.current) return null;
    
    // Clear cache for this request
    const cacheKey = `${apiFunction.name}_${JSON.stringify(args)}`;
    requestCache.delete(cacheKey);
    
    setRefreshing(true);
    return execute(...args);
  }, [execute, apiFunction.name]);

  useEffect(() => {
    if (immediate && isMounted.current && !isExecuting.current) {
      execute();
    }
  }, []); // Only run on mount

  return {
    data,
    loading,
    error,
    refreshing,
    execute,
    refresh,
    setData
  };
};

// Safe wrapper for optional requests. Missing endpoints are only swallowed when
// explicitly enabled by the caller.
export const useSafeApi = (apiFunction, immediate = true, initialData = null, shouldExecute = true, allowMissingEndpoint = false) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);
  const hasExecuted = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const execute = useCallback(async (...args) => {
    // Don't execute if disabled or already executed on this mount
    if (!shouldExecute || !isMounted.current || (hasExecuted.current && immediate)) {
      return null;
    }

    hasExecuted.current = true;

    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction(...args);
      
      if (isMounted.current) {
        setData(result.data || result);
      }
      return result;
    } catch (err) {
      if (isMounted.current) {
        // Handle 404 gracefully - return default data
        if (allowMissingEndpoint && (err.message?.includes('not found') || err.message?.includes('Resource not found'))) {
          setData(initialData);
          setError(null); // Don't show error for missing endpoints
          console.log(`Endpoint not available: ${apiFunction.name}. Using default data.`);
        } else {
          const errorMessage = apiService.handleApiError(err);
          setError(errorMessage);
        }
      }
      return null;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, shouldExecute, initialData, immediate, allowMissingEndpoint]);

  const refresh = useCallback(async (...args) => {
    hasExecuted.current = false;
    return execute(...args);
  }, [execute]);

  useEffect(() => {
    if (immediate && shouldExecute && !hasExecuted.current) {
      execute();
    }
  }, [immediate, shouldExecute]); // Removed execute from deps

  return {
    data,
    loading,
    error,
    execute,
    refresh,
    setData
  };
};

// Specialized hooks
export const useShipments = (filters = {}, immediate = true) => {
  return useApi(
    () => apiService.getAllShipments(1, 10, filters.status),
    immediate,
    []
  );
};

export const useActiveShipments = (immediate = true) => {
  return useApi(
    () => apiService.getActiveShipments(),
    immediate,
    []
  );
};

export const useBookings = (filters = {}, immediate = true) => {
  return useApi(
    () => apiService.getAllBookings(1, 10, filters.status),
    immediate,
    []
  );
};

export const useCorporateDashboardStats = (immediate = true) => {
  return useApi(
    () => apiService.getCorporateDashboardStats(),
    immediate,
    { activeBookings: 0, completedBookings: 0, totalSpend: 0, onTimeRate: '0%' }
  );
};

export const useAvailableJobs = (filters = {}, immediate = true) => {
  return useApi(
    () => apiService.getAvailableJobs(1, 10, filters),
    immediate,
    []
  );
};

// Safe version that won't error on 404
export const useSafeAvailableJobs = (filters = {}, shouldExecute = true) => {
  return useSafeApi(
    () => apiService.getAvailableJobs(1, 10, filters),
    shouldExecute,
    [],
    shouldExecute
  );
};

export const useTransporterDashboardStats = (immediate = true) => {
  return useSafeApi(
    () => apiService.getTransporterDashboardStats(),
    immediate,
    { activeJobs: 0, pendingPayment: 0, earnings: 0, totalTrips: 0, rating: 0 },
    immediate
  );
};

export const useTransporterRecentActivity = (limit = 5, immediate = true) => {
  return useSafeApi(
    () => apiService.getTransporterRecentActivity(limit),
    immediate,
    [],
    immediate
  );
};

export const useTransporterAvailableJobs = (filters = {}, immediate = true) => {
  return useSafeApi(
    () => apiService.getTransporterAvailableJobs(1, 10, filters),
    immediate,
    [],
    immediate
  );
};

// Shipper hooks
export const useShipperDashboardStats = (immediate = true) => {
  return useSafeApi(
    () => apiService.getShipperDashboardStats(),
    immediate,
    { activeJobs: 0, pendingPayment: 0, spending: 0, totalShipments: 0 },
    immediate
  );
};

export const useShipperRecentActivity = (limit = 5, immediate = true) => {
  return useSafeApi(
    () => apiService.getShipperRecentActivity(limit),
    immediate,
    [],
    immediate
  );
};

// Trailer Owner hooks
export const useTrailerOwnerDashboardStats = (immediate = true) => {
  return useSafeApi(
    () => apiService.getTrailerOwnerDashboardStats(),
    immediate,
    { 
      totalTrailers: 0, 
      available: 0, 
      rented: 0, 
      maintenance: 0, 
      monthlyEarnings: 0, 
      pendingPayouts: 0, 
      utilizationRate: '0%' 
    },
    immediate
  );
};

export const useTrailerOwnerRecentActivity = (limit = 5, immediate = true) => {
  return useSafeApi(
    () => apiService.getTrailerOwnerRecentActivity(limit),
    immediate,
    [],
    immediate
  );
};

export const useTrailerOwnerTrailers = (immediate = true) => {
  return useSafeApi(
    () => apiService.getTrailerOwnerTrailers(),
    immediate,
    [],
    immediate
  );
};
