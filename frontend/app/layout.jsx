import './globals.css';

export const metadata = {
  title: 'Growth Agent',
  description: 'Personal Reddit growth agent dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-6">
          <span className="font-semibold text-white">Growth Agent</span>
          <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            Dashboard
          </a>
          <a href="/config" className="text-sm text-gray-400 hover:text-white transition-colors">
            Config
          </a>
        </nav>
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
