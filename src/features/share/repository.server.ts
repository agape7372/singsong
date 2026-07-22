import "server-only";
import { LocalShareRepository } from "./local-repository.server";
import { SupabaseShareRepository } from "./supabase-repository.server";
import type { ShareRepository } from "./types";
import { getRuntimeProfile } from "@/server/runtime-profile";

let localRepository: LocalShareRepository | null = null;
let supabaseRepository: SupabaseShareRepository | null = null;

export function getShareRepository(): ShareRepository {
  if (getRuntimeProfile() === "fixture") return (localRepository ??= new LocalShareRepository());
  return (supabaseRepository ??= new SupabaseShareRepository());
}
