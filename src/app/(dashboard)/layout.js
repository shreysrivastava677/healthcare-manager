import DashboardShell from '@/components/layout/DashboardShell';

export const metadata = {
  title: 'Dashboard | HealthCare Manager',
};

export default function DashboardLayout({ children }) {
  return <DashboardShell>{children}</DashboardShell>;
}
