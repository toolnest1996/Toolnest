/** Hard redirect — clears Supabase session cookies server-side */
export function adminLogout() {
  window.location.href = "/admin/logout";
}
