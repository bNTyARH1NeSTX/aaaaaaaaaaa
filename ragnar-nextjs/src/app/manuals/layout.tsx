export default function ManualLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      {children}
    </div>
  );
}
