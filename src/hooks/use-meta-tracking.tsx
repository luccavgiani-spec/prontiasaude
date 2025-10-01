import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/meta-tracking';

// Hook to automatically track page views on route changes
export function useMetaTracking() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    trackPageView();
  }, [location.pathname]);
}
