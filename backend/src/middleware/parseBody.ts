import type express from "express";

type Schema<T> = {
  safeParse: (data: unknown) =>
    | { success: true; data: T }
    | { success: false; error: { issues: { message: string }[] } };
};

export function parseBody<T>(schema: Schema<T>, body: unknown, res: express.Response): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join("; ");
    res.status(400).json({ error: message });
    return null;
  }

  return result.data;
}
