// Google Apps Script API integration
import { callGas } from './gas-proxy';

// Types for GAS API
export interface GASRegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface GASScheduleRequest {
  user_id: string;
  email: string;
  nome: string;
  especialidade: string;
  horario_iso: string;
  plano_ativo: boolean;
  servico: string;
  // Campos adicionais para Clicklife quando necessário
  cpf?: string;
  adicional?: string;
  cupom?: string;
  fotos_base64?: string[];
}

export interface GASAppointmentData {
  id: string;
  service_name: string;
  scheduled_date: string;
  status: string;
  join_url?: string;
  provider?: string;
  external_appointment_id?: string;
}

// Register patient in Google Sheets
export async function gasRegisterPatient(data: GASRegisterRequest): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Registering patient via GAS:', data);
    
    const { json: result } = await callGas('site-register', data);
    
    if (result && result.success === false) {
      throw new Error(result.error || 'Unknown error from GAS');
    }

    console.log('Patient registered in GAS successfully:', result);
    return { success: true };
  } catch (error) {
    console.error('Error registering patient in GAS:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Schedule appointment in Google Sheets
export async function gasScheduleAppointment(data: GASScheduleRequest): Promise<{ success: boolean; error?: string; appointment_id?: string }> {
  try {
    console.log('Scheduling appointment via GAS:', data);
    
    const { json: result } = await callGas('site-schedule', data);
    
    if (result && result.success === false) {
      throw new Error(result.error || 'Unknown error from GAS');
    }

    console.log('Appointment scheduled in GAS successfully:', result);
    return { 
      success: true,
      appointment_id: result?.appointment_id 
    };
  } catch (error) {
    console.error('Error scheduling appointment in GAS:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get appointments from Google Sheets (for patient area)
export async function gasGetAppointments(email: string): Promise<{ success: boolean; appointments?: GASAppointmentData[]; error?: string }> {
  try {
    console.log('Fetching appointments from GAS for:', email);
    
    const { json: result } = await callGas('get-appointments', { email });
    
    if (result && result.success === false) {
      throw new Error(result.error || 'Unknown error from GAS');
    }

    console.log('Appointments fetched from GAS successfully:', result);
    return { 
      success: true,
      appointments: result?.appointments || []
    };
  } catch (error) {
    console.error('Error fetching appointments from GAS:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}