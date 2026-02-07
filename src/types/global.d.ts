// Type definitions for global window objects

declare global {
  interface Window {
    // Mercado Pago SDK global
    MercadoPago?: any;
    __mpGlobal?: any;
    MP_DEVICE_SESSION_ID?: string;
    
    // Facebook Pixel native function
    fbq?: (command: string, eventName: string, data?: any) => void;
    
    // Google Analytics 4 & Google Ads (gtag.js)
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    gtagEvent?: (eventName: string, params?: Record<string, any>) => void;
    
    // Meta Pixel tracking functions
    trackPageView?: () => void;
    trackViewContent?: (data?: {
      content_name?: string;
      content_category?: string;
      content_ids?: string[];
      value?: number;
    }) => void;
    trackLead?: (data?: {
      value?: number;
      content_name?: string;
    }) => void;
    trackPurchase?: (data: {
      value: number;
      order_id: string;
      contents?: Array<{
        id: string;
        quantity: number;
        item_price?: number;
      }>;
      content_name?: string;
    }) => void;
  }
}

// Google Sheets integration removed
export interface UpsertPatientResponse {
  success: boolean;
  error?: string;
}

export interface CheckoutSession {
  id?: string;
  url?: string;
  error?: string;
}

export interface PatientSummary {
  appointments: Appointment[];
  orders: Order[];
  subscription?: Subscription;
}

export interface Appointment {
  id: string;
  service_name: string;
  scheduled_date: string;
  status: string;
  join_url?: string;
}

export interface Order {
  id: string;
  sku: string;
  created_at: string;
  status: string;
  amount: number;
}

export interface Subscription {
  plan_code: string;
  status: string;
  current_period_end: string;
}

export {};