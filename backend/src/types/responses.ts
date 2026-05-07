// ______ Tipi di risposta condivisi tra handler HTTP e service layer ______
// ______ Mantengono coerente il contratto API tra backend e frontend ______
export type UserRole = "admin" | "user";

export type AuthUserResponse = {
  userId: number;
  email: string;
  username: string;
  role: UserRole;
  mustChangePassword: boolean;
};

export type AuthSessionResponse = {
  user: AuthUserResponse;
};

export type ApiMessageResponse = {
  ok: boolean;
  message: string;
};

export type RegisterRequestResponse = ApiMessageResponse;

export type PublicUserResponse = {
  userId: number;
  username: string;
  email: string;
  mustChangePassword: boolean;
  createdAt: Date;
  anagraphicsRef: {
    nome: string;
    cognome: string;
    fotoProfilo: string;
  } | null;
};

export type AdminUserResponse = {
  userId: number;
  email: string;
  username: string;
  role: "user";
  subscribed: "active" | "inactive";
  mustChangePassword: boolean;
  createdAt: Date;
  anagraphicsRef: {
    nome: string;
    cognome: string;
    telefono: string | null;
    indirizzo: string | null;
    fotoProfilo: string;
  } | null;
  userStateRef: {
    status: "online" | "offline" | "nonAlComputer";
    lastOnline: Date;
  } | null;
};

export type AdminCreateUserResponse = {
  userId: number;
  email: string;
  username: string;
  role: "user";
  mustChangePassword: boolean;
};

export type ToggleSubscriptionResponse = {
  ok: true;
  subscribed: "active" | "inactive";
  message: string;
};

export type ProfilePictureUploadResponse = {
  ok: true;
  path: string;
  message: string;
};
