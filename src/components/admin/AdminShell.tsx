import React from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { BreadcrumbProvider } from "@/components/admin/BreadcrumbContext";

interface AdminShellProps {
  children: React.ReactNode;
  adminName: string;
  adminEmail: string;
  adminRole: string;
}

export const AdminShell = ({ children, adminName, adminEmail, adminRole }: AdminShellProps) => {
  return (
    <BreadcrumbProvider>
      <div className="flex h-screen bg-dark-bg overflow-hidden">
        <AdminSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <AdminTopbar adminName={adminName} adminEmail={adminEmail} adminRole={adminRole} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
};
