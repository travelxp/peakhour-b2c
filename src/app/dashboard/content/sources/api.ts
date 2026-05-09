import { api } from "@/lib/api";
import type {
  CreateSourceInput,
  ListResponse,
  PatchSourceInput,
  SourceStatus,
  SourceType,
} from "./types";

/**
 * Thin client wrappers around `/v1/sources/trusted`. Kept as plain
 * async functions (no react-query layer here) so consumers stay free
 * to choose their own data-fetching strategy. The page uses
 * @tanstack/react-query already; these are the queryFns it passes in.
 */

export interface ListParams {
  status?: SourceStatus;
  type?: SourceType;
  limit?: number;
}

export async function listSources(params: ListParams = {}): Promise<ListResponse> {
  const query: Record<string, string> = {};
  if (params.status) query.status = params.status;
  if (params.type) query.type = params.type;
  if (params.limit) query.limit = String(params.limit);
  return api.get<ListResponse>("/v1/sources/trusted", query);
}

export async function createSource(input: CreateSourceInput): Promise<{ _id: string }> {
  return api.post<{ _id: string }>("/v1/sources/trusted", input);
}

export async function patchSource(
  id: string,
  input: PatchSourceInput,
): Promise<{ _id: string; updated: number }> {
  return api.patch<{ _id: string; updated: number }>(`/v1/sources/trusted/${id}`, input);
}

/**
 * Soft-delete via the dedicated endpoint. The backend transitions
 * the row to status:"inactive" and stamps inactivatedAt — it does
 * NOT remove the document (cnt_source_usage rows reference the
 * trustedSourceId; hard-delete would orphan audit trails).
 */
export async function deleteSource(
  id: string,
): Promise<{ _id: string; softDeleted: boolean }> {
  return api.delete<{ _id: string; softDeleted: boolean }>(`/v1/sources/trusted/${id}`);
}
