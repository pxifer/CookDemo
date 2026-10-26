export interface RegistrationCode { challenge: string; expiresIn: number }
export interface RegistrationInput { username: string; password: string; code: string; challenge: string }
export interface CaptchaImage { challenge: string; image: string }
export const validUsername = (name: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{4,23}$/.test(name)&&/[a-zA-Z]/.test(name);
export const validNewPassword = (password: string) => password.length >= 8 && password.length <= 32
  && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password);
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
