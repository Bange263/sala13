import { z } from "zod";

const pointSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  t: z.number().int().nonnegative().optional()
});

export const strokeSchema = z.object({
  id: z.string().uuid(),
  tool: z.enum(["brush", "eraser"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  size: z.number().finite().min(1).max(48),
  points: z.array(pointSchema).min(2).max(256)
});

/**
 * Engine-side template. Call this only after checking that playerId is the
 * active drawer. Coordinates are normalized so every viewport renders the
 * same vector path.
 */
export function validateStroke(intent) {
  return strokeSchema.parse(intent);
}
