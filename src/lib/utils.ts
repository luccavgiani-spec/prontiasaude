import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatação de preço brasileiro
export function formataPreco(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

// Normalização de telefone para formato E164
export function normalizaPhoneE164(telefone: string): string {
  // Remove todos os caracteres não numéricos
  const numeros = telefone.replace(/\D/g, '');
  
  // Se começar com 55, já está no formato internacional
  if (numeros.startsWith('55')) {
    return `+${numeros}`;
  }
  
  // Se tem 11 dígitos (celular) ou 10 dígitos (fixo), adiciona código do Brasil
  if (numeros.length >= 10) {
    return `+55${numeros}`;
  }
  
  // Retorna como está se não conseguir normalizar
  return `+55${numeros}`;
}

// Gerenciamento de email no localStorage
export function getEmailAtual(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('medicosDoBem_email');
}

export function setEmailAtual(email: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('medicosDoBem_email', email);
}

// Gerenciamento de telefone no localStorage  
export function getPhone(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('medicosDoBem_phone');
}

export function setPhone(phone: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('medicosDoBem_phone', phone);
}

// Validação de email
export function isEmailValid(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validação de telefone brasileiro
export function isTelefoneValid(telefone: string): boolean {
  const numeros = telefone.replace(/\D/g, '');
  return numeros.length >= 10 && numeros.length <= 11;
}

// Formatação de data brasileira
export function formatarData(data: string | Date): string {
  const dataObj = typeof data === 'string' ? new Date(data) : data;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  }).format(dataObj);
}

// Formatação de data e hora
export function formatarDataHora(data: string | Date): string {
  const dataObj = typeof data === 'string' ? new Date(data) : data;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dataObj);
}

// Cálculo de desconto de plano (apenas visual)
export function calcularDescontoPlano(precoMensal: number, meses: number, desconto: number): number {
  const total = precoMensal * meses;
  return total * (1 - desconto);
}