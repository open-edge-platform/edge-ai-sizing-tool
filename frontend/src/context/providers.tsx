import { SidebarProvider } from '@/components/ui/sidebar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider
        defaultOpen={true}
        style={
          {
            '--sidebar-width': '400px',
          } as React.CSSProperties
        }
      >
        {children}
      </SidebarProvider>
    </QueryClientProvider>
  )
}
