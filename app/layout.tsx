import './globals.css';
import { AppShellProvider } from '@/components/layout/AppShellProvider';
import { AppThemeProvider } from '@/components/theme/AppThemeProvider';
import { DimensionIconsProvider } from '@/context/DimensionIconsContext';

export const metadata = {
  title: 'RA-H Open Source',
  description: 'Local-first research workspace with a BYO-key AI orchestrator',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppThemeProvider>
          <AppShellProvider>
            <DimensionIconsProvider>
              {children}
            </DimensionIconsProvider>
          </AppShellProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
