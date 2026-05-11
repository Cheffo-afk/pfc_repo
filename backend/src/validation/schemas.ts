import { z } from "zod";

// ______ Schemi Zod per la validazione dei body HTTP ______
// ______ Ogni schema corrisponde ad una route specifica; parseBody li usa direttamente ______
// ______ POST /auth/login ______
export const LoginSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(1, "Password obbligatoria"),
});

// ______ POST /auth/change-password ______
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password corrente obbligatoria"),
  newPassword: z.string().min(8, "La nuova password deve avere almeno 8 caratteri"),
});

// ______ POST /admin/users ______
export const AdminCreateUserSchema = z.object({
  nome: z.string().min(1, "Nome obbligatorio"),
  cognome: z.string().min(1, "Cognome obbligatorio"),
  email: z.string().email("Email non valida"),
  username: z.string().min(1, "Username obbligatorio"),
  initialPassword: z.string().min(8, "La password iniziale deve avere almeno 8 caratteri"),
});

// ______ PATCH /admin/users/:userId/initial-password ______
export const InitialPasswordSchema = z.object({
  initialPassword: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

// ______ PATCH /admin/users/:userId/subscription ______
export const ToggleSubscriptionSchema = z.object({
  adminPassword: z.string().min(1, "Password amministratore obbligatoria"),
});

// ______ POST /users (richiesta iscrizione pubblica) ______
export const RegisterRequestSchema = z.object({
  nome: z.string().min(1, "Nome obbligatorio"),
  cognome: z.string().min(1, "Cognome obbligatorio"),
  username: z.string().min(1, "Username obbligatorio"),
  email: z.string().email("Email non valida"),
});

// ______ PATCH /users/me/profile ______
export const UpdateOwnProfileSchema = z.object({
  username: z.string().min(1, "Username obbligatorio").max(80, "Username troppo lungo"),
  telefono: z.string().max(30, "Telefono troppo lungo").optional().nullable(),
  indirizzo: z.string().max(255, "Indirizzo troppo lungo").optional().nullable(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;
export type InitialPasswordInput = z.infer<typeof InitialPasswordSchema>;
export type ToggleSubscriptionInput = z.infer<typeof ToggleSubscriptionSchema>;
export type RegisterRequestInput = z.infer<typeof RegisterRequestSchema>;
export type UpdateOwnProfileInput = z.infer<typeof UpdateOwnProfileSchema>;
