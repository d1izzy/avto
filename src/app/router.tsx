import { lazy, Suspense } from "react";
import { Loading } from "@/components/studio-ui";
import { VStack, Heading } from "@astryxdesign/core";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { TenantProvider } from "@/features/tenant/context";
import { OwnerGuard } from "@/features/auth/owner-guard";
import { PublicLayout } from "@/layouts/public-layout";
import { OwnerLayout } from "@/layouts/owner-layout";
import { TenantHome } from "@/pages/tenant-home";
import { BookingDetail } from "@/pages/booking-detail";
import { OwnerLogin } from "@/pages/owner-login";
import { CustomerBookings, InstallPage } from "@/pages/customer-pages";

const OwnerPages = {
  Dashboard: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerDashboard }))),
  Bookings: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerBookings }))),
  Calendar: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerCalendar }))),
  Services: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerServices }))),
  Resources: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerResources }))),
  Customers: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerCustomers }))),
  Settings: lazy(() => import("@/pages/owner-pages").then((m) => ({ default: m.OwnerSettings })))
};
const pending = <Loading />;

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/s/graphite" replace /> },
  { path: "/s/:tenantSlug", element: <TenantProvider><PublicLayout /></TenantProvider>, children: [
    { index: true, element: <TenantHome /> },
    { path: "services", element: <TenantHome /> },
    { path: "book", element: <TenantHome booking /> },
    { path: "booking/:token", element: <BookingDetail /> },
    { path: "account", element: <CustomerBookings /> },
    { path: "install", element: <InstallPage /> },
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
  { path: "*", element: <VStack as="main" padding={8}><Heading level={1}>Страница не найдена</Heading></VStack> }
]);
