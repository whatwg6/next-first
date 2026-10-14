export const roleLabels = {
  user: "普通用户",
  admin: "管理员",
  superadmin: "超级管理员",
};

export function isAdmin(user) {
  return user?.role === "admin" || user?.role === "superadmin";
}

export function canManageUser(actor, target) {
  if (actor.id === target.id || target.role === "superadmin") return false;
  return (
    actor.role === "superadmin" ||
    (actor.role === "admin" && target.role === "user")
  );
}
