import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteBanner } from "@/components/layout/site-banner";
import { MaintenanceBanner } from "@/components/layout/maintenance-banner";
import { CommandMenuProvider } from "@/components/command-menu";
import { PublicCategoriesProvider } from "@/components/public-categories-provider";
import { PublicToolsProvider } from "@/components/public-tools-provider";
import { getSiteSettings } from "@/lib/settings";
import { getPublicCategories } from "@/lib/categories/config";
import { getPublicTools } from "@/lib/tools/config";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, publicTools, publicCategories] = await Promise.all([
    getSiteSettings(),
    getPublicTools(),
    getPublicCategories(),
  ]);
  const maintenance = settings.maintenance_mode === "true";

  return (
    <PublicCategoriesProvider categories={publicCategories}>
    <PublicToolsProvider tools={publicTools}>
    <CommandMenuProvider>
    <div className="flex min-h-screen flex-col">
      {maintenance && <MaintenanceBanner message={settings.maintenance_message} />}
      <SiteBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer categories={publicCategories} />
    </div>
    </CommandMenuProvider>
    </PublicToolsProvider>
    </PublicCategoriesProvider>
  );
}
