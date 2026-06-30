/**
 * Icon — chuẩn hóa icon về lucide (SVG, nhẹ, tree-shakeable).
 * Nhận tên Material Symbol (để tương thích code cũ) và map sang lucide.
 * Tên CHƯA map sẽ fallback về <span class="material-symbols-outlined"> để KHÔNG vỡ giao diện.
 *
 * Dùng: <Icon name="space_dashboard" size={18} className="..." />
 * Migrate dần: thay <span className="material-symbols-outlined">x</span> → <Icon name="x" />
 */
import {
    LayoutDashboard, LayoutGrid, Activity, MessageSquare, BarChart3,
    ClipboardCheck, ReceiptText, Briefcase, FileText, ListPlus, ShieldCheck,
    Gavel, FolderCog, Landmark, Columns3, Wallet, CircleDollarSign, Calculator,
    Network, BookOpen, ClipboardList, Receipt, Repeat, CalendarDays, HardHat,
    Wrench, Truck, HandCoins, Warehouse, ListChecks, CalendarClock, Handshake,
    Package, Settings, UserCog, User, History, CircleHelp, ChevronLeft,
    ChevronRight, ChevronDown, LogOut, Menu, Plus, Search, X,
} from 'lucide-react';

// Material Symbol name → lucide component
const MAP = {
    space_dashboard: LayoutDashboard,
    grid_view: LayoutGrid,
    monitoring: Activity,
    chat: MessageSquare,
    analytics: BarChart3,
    assignment_turned_in: ClipboardCheck,
    receipt_long: ReceiptText,
    work: Briefcase,
    description: FileText,
    playlist_add: ListPlus,
    security: ShieldCheck,
    gavel: Gavel,
    folder_managed: FolderCog,
    account_balance: Landmark,
    view_week: Columns3,
    account_balance_wallet: Wallet,
    monetization_on: CircleDollarSign,
    calculate: Calculator,
    account_tree: Network,
    menu_book: BookOpen,
    assessment: ClipboardList,
    receipt: Receipt,
    repeat: Repeat,
    calendar_month: CalendarDays,
    construction: HardHat,
    engineering: Wrench,
    local_shipping: Truck,
    request_quote: HandCoins,
    warehouse: Warehouse,
    task_alt: ListChecks,
    edit_calendar: CalendarClock,
    build: Wrench,
    handshake: Handshake,
    inventory_2: Package,
    settings: Settings,
    admin_panel_settings: UserCog,
    person: User,
    history: History,
    help_center: CircleHelp,
    chevron_left: ChevronLeft,
    chevron_right: ChevronRight,
    expand_more: ChevronDown,
    logout: LogOut,
    menu: Menu,
    add: Plus,
    search: Search,
    close: X,
};

export default function Icon({ name, size = 20, className = '', strokeWidth = 2, ...rest }) {
    const Lucide = MAP[name];
    if (Lucide) {
        return <Lucide size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" {...rest} />;
    }
    // Fallback: icon chưa map → vẫn dùng Material Symbols (không vỡ UI)
    return (
        <span
            className={`material-symbols-outlined notranslate ${className}`}
            style={{ fontSize: size }}
            translate="no"
            aria-hidden="true"
            {...rest}
        >
            {name}
        </span>
    );
}
