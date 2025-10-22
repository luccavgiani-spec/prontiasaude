import { supabase } from "@/integrations/supabase/client";
import { getPatientPlan } from './patient-plan';

export interface AppointmentData {
  appointment_id?: string;
  email: string;
  service_code: string;
  start_at_local: string; // ISO 8601 com offset: 2025-09-03T16:00:00-03:00
  duration_min: number;
  status?: string;
  order_id?: string;
  teams_join_url?: string;
  teams_meeting_id?: string;
  created_at?: string;
}

export interface CreateAppointmentRequest {
  email: string;
  service_code: string;
  start_at_local: string;
  duration_min: number;
  status?: string;
  order_id?: string;
}

export interface CheckoutWithAppointmentRequest {
  mode: 'payment' | 'subscription';
  price_id?: string;
  email: string;
  product_name?: string;
  product_sku?: string;
  plan_name?: string;
  plan_code?: string;
  success_url?: string;
  cancel_url?: string;
  // Campos do agendamento
  appointment_id?: string;
  service_code?: string;
  start_at_local?: string;
  duration_min?: number;
  order_id?: string;
}

/**
 // Google Sheets integration removed
 */
export async function createAppointment(data: CreateAppointmentRequest): Promise<{ 
  success: boolean; 
  appointment_id?: string; 
  error?: string; 
}> {
  try {
    // First create in Supabase
    const { data: result, error } = await supabase.functions.invoke('appointments-manager', {
      body: {
        operation: 'create_appointment',
        ...data
      }
    });

    if (error) throw error;
    
    const appointmentId = result?.appointment_id;
    
    return {
      success: true,
      appointment_id: appointmentId
    };
  } catch (error) {
    console.error('Error creating appointment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Atualiza um agendamento existente
 */
export async function updateAppointment(appointment_id: string, data: Partial<CreateAppointmentRequest>): Promise<{ 
  success: boolean; 
  error?: string; 
}> {
  try {
    const { data: result, error } = await supabase.functions.invoke('appointments-manager', {
      body: {
        operation: 'update_appointment',
        appointment_id,
        ...data
      }
    });

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating appointment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Busca agendamentos por email
 */
export async function getAppointments(email: string): Promise<{ 
  success: boolean; 
  appointments?: AppointmentData[]; 
  error?: string; 
}> {
  try {
    console.log('Fetching appointments for:', email);
    
    // TODO: Implementar busca real quando tabela appointments estiver configurada
    return {
      success: true,
      appointments: []
    };
  } catch (error) {
    console.error('Error in getAppointments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Busca um agendamento específico por ID
 */
export async function getAppointment(appointment_id: string): Promise<{ 
  success: boolean; 
  appointment?: AppointmentData | null; 
  error?: string; 
}> {
  try {
    const { data: result, error } = await supabase.functions.invoke('appointments-manager', {
      body: {
        operation: 'get_appointment',
        appointment_id
      }
    });

    if (error) throw error;
    
    return {
      success: true,
      appointment: result.appointment
    };
  } catch (error) {
    console.error('Error getting appointment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Cria checkout com agendamento (fluxo completo)
 * 1. Cria o agendamento no sistema
 * 2. Cria a sessão de checkout no Stripe com metadata
 */
export async function createCheckoutWithAppointment(data: CheckoutWithAppointmentRequest): Promise<{ 
  success: boolean; 
  url?: string; 
  appointment_id?: string; 
  error?: string; 
}> {
  try {
    // 1. Primeiro cria o agendamento se os dados foram fornecidos
    let appointmentId = data.appointment_id;
    
    if (!appointmentId && data.service_code && data.start_at_local && data.duration_min) {
      const appointmentResult = await createAppointment({
        email: data.email,
        service_code: data.service_code,
        start_at_local: data.start_at_local,
        duration_min: data.duration_min,
        status: 'scheduled',
        order_id: data.order_id
      });

      if (!appointmentResult.success) {
        throw new Error(appointmentResult.error || 'Failed to create appointment');
      }

      appointmentId = appointmentResult.appointment_id;
    }

    // 2. Cria a sessão de checkout com metadata do agendamento
    const { data: result, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        ...data,
        appointment_id: appointmentId
      }
    });

    if (error) throw error;
    
    return {
      success: true,
      url: result.url,
      appointment_id: appointmentId
    };
  } catch (error) {
    console.error('Error creating checkout with appointment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Formatar data/hora para timezone de São Paulo (America/Sao_Paulo)
 */
export function formatDateTimeForBrazil(date: Date): string {
  return date.toLocaleString('sv-SE', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(' ', 'T') + '-03:00';
}

/**
 * Gerar horários disponíveis para um dia específico
 */
export function generateAvailableSlots(date: Date, durationMin: number = 30): string[] {
  const slots: string[] = [];
  const startHour = 8; // 8h
  const endHour = 18;  // 18h
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += durationMin) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, minute, 0, 0);
      
      // Pular fins de semana
      if (slotDate.getDay() === 0 || slotDate.getDay() === 6) continue;
      
      slots.push(formatDateTimeForBrazil(slotDate));
    }
  }
  
  return slots;
}