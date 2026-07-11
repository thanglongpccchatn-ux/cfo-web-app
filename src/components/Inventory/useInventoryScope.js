import { useAuth } from '../../context/AuthContext';

/**
 * Phạm vi Kho vật tư cho user hiện tại:
 *  - showPrice: được xem giá (view_material_price) hay không.
 *  - viewAll: xem mọi công trình (view_all_inventory) hay bị giới hạn.
 *  - assignedProjects: danh sách công trình được phân công (điều chuyển đang hiệu lực);
 *    1 người có thể kiêm nhiều kho -> nhiều công trình.
 *  - defaultProject: công trình mặc định hiển thị.
 */
export function useInventoryScope() {
  const { profile, hasPermission, assignedProjects } = useAuth();
  const isAdmin = profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN';
  const showPrice = isAdmin || hasPermission('view_material_price');
  const viewAll = isAdmin || hasPermission('view_all_inventory');
  const assigned = (assignedProjects && assignedProjects.length)
    ? assignedProjects
    : (profile?.current_project_id ? [profile.current_project_id] : []);
  const defaultProject = (profile?.current_project_id && assigned.includes(profile.current_project_id))
    ? profile.current_project_id
    : (assigned[0] || '');
  return { isAdmin, showPrice, viewAll, assignedProjects: assigned, defaultProject };
}
