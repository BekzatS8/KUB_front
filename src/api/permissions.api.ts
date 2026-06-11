import api from "./index"
import type { PermissionsMe } from "@/src/models/permissions.model"

export async function getMyPermissions(): Promise<PermissionsMe> {
  const res = await api.get("/permissions/me")
  return res.data
}
