import "express-session";

// ______ Augment di SessionData per aggiungere il payload authUser ______
// ______ Consente type-safety su req.session.authUser in tutto il backend ______
declare module "express-session" {
  interface SessionData {
    authUser?: {
      userId: number;
      role: "admin" | "user";
      email: string;
    };
  }
}
