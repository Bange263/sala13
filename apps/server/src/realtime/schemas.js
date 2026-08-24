import { ROOM_VISIBILITY } from "@sala13/shared";
import { z } from "zod";

const playerId = z.string().uuid();
const playerName = z.string().trim().min(2).max(20);
const roomCode = z.string().trim().min(4).max(10).transform((value) => value.toUpperCase());
const password = z.string().max(64).optional().default("");

export const createRoomSchema = z.object({
  gameId: z.string().trim().min(1).max(40),
  playerId,
  name: playerName,
  visibility: z.enum([ROOM_VISIBILITY.PUBLIC, ROOM_VISIBILITY.PRIVATE]),
  password,
  settings: z
    .object({
      maxPlayers: z.number().int().min(2).max(20).optional(),
      variant: z.string().trim().max(32).optional(),
      mode: z.string().trim().max(32).optional(),
      stacking: z.boolean().optional()
    })
    .optional()
    .default({})
});

export const joinRoomSchema = z.object({
  code: roomCode,
  playerId,
  name: playerName,
  password
});

export const readySchema = z.object({ ready: z.boolean() });

export const gameActionSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  action: z
    .object({
      type: z.string().trim().min(1).max(32),
      cell: z.number().int().optional()
    })
    .passthrough()
});
