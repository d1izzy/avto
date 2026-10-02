import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { TenantProvider } from "@/features/tenant/context";
import { OwnerGuard } from "@/features/auth/owner-guard";
import { PublicLayout } from "@/layouts/public-layout";
import { OwnerLayout } from "@/layouts/owner-layout";
import { TenantHome } from "@/pages/tenant-home";
import { BookingFlow } from "@/pages/booking-flow";
import { BookingDetail } from "@/pages/booking-detail";
import { OwnerLogin } from "@/pages/owner-login";

const OwnerPages = {
  Dashboard: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerDashboard }))),
  Bookings: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerBookings }))),
  Calendar: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerCalendar }))),
  Services: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerServices }))),
  Resources: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerResources }))),
  Customers: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerCustomers }))),
  Settings: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerSettings })))
};
const pending = <div className="grid min-h-[50vh] place-items-center text-white/50">Загрузка...</div>;

export const router = createBrowserRouter([
  { path: "/", element: <main className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-center text-white"><div><h1 className="text-3xl font-bold">ServiceSlot</h1><p className="mt-2 text-white/50">Откройте ссылку вашего сервиса.</p></div></main> },
  { path: "/s/:tenantSlug", element: <TenantProvider><PublicLayout /></TenantProvider>, children: [
    { index: true, element: <TenantHome /> },
    { path: "services", element: <TenantHome /> },
    { path: "book", element: <BookingFlow /> },
    { path: "booking/:token", element: <BookingDetail /> },
    { path: "owner", element: <OwnerLogin /> },
    { element: <OwnerGuard />, children: [{ element: <OwnerLayout />, children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "owner/dashboard", element: <Suspense fallback={pending}><OwnerPages.Dashboard /></Suspense> },
      { path: "owner/bookings", element: <Suspense fallback={pending}><OwnerPages.Bookings /></Suspense> },
      { path: "owner/calendar", element: <Suspense fallback={pending}><OwnerPages.Calendar /></Suspense> },
      { path: "owner/services", element: <Suspense fallback={pending}><OwnerPages.Services /></Suspense> },
      { path: "owner/resources", element: <Suspense fallback={pending}><OwnerPages.Resources /></Suspense> },
      { path: "owner/customers", element: <Suspense fallback={pending}><OwnerPages.Customers /></Suspense> },
      { path: "owner/settings", element: <Suspense fallback={pending}><OwnerPages.Settings /></Suspense> }
    ] }] }
  ] },
  { path: "*", element: <main className="grid min-h-screen place-items-center bg-[#0a0a0a] text-white"><h1>Страница не найдена</h1></main> }
]);
